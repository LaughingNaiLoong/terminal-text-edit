import React, { useState, useCallback, useMemo } from "react";
import {
	Slate,
	Editable,
	withReact,
	useSlate,
	type RenderLeafProps,
} from "slate-react";
import { Editor, Transforms, Text, createEditor, type Descendant } from "slate";
import { withHistory } from "slate-history";
import type { ReactEditor } from "slate-react";

import {
	MdFormatBold,
	MdFormatItalic,
	MdFormatUnderlined,
	MdFormatColorText,
	MdFormatColorFill,
	MdClear,
	MdContentCopy,
} from "react-icons/md";
import { BsGithub } from "react-icons/bs";

interface Language {
	name: string;
	escapeChar: string;
}

type CustomText = {
	text: string;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	fg?: number;
	bg?: number;
};

type CustomElement = { type: "paragraph"; children: CustomText[] };

declare module "slate" {
	interface CustomTypes {
		Editor: ReactEditor;
		Element: CustomElement;
		Text: CustomText;
	}
}

const languages: Language[] = [
	{ name: "C++", escapeChar: "\\033" },
	{ name: "Python", escapeChar: "\\x1b" },
	{ name: "JavaScript", escapeChar: "\\x1b" },
	{ name: "Rust", escapeChar: "\\x1b" },
];

const generate256Colors = (): string[] => {
	const colors: string[] = [];
	const sys = [
		"#000000",
		"#800000",
		"#008000",
		"#808000",
		"#000080",
		"#800080",
		"#008080",
		"#c0c0c0",
		"#808080",
		"#ff0000",
		"#00ff00",
		"#ffff00",
		"#0000ff",
		"#ff00ff",
		"#00ffff",
		"#ffffff",
	];
	colors.push(...sys);
	const levels = [0, 95, 135, 175, 215, 255];
	for (let r = 0; r < 6; r++) {
		for (let g = 0; g < 6; g++) {
			for (let b = 0; b < 6; b++) {
				colors.push(
					`#${levels[r].toString(16).padStart(2, "0")}${levels[g].toString(16).padStart(2, "0")}${levels[b].toString(16).padStart(2, "0")}`,
				);
			}
		}
	}
	for (let i = 0; i < 24; i++) {
		const gray = 8 + i * 10;
		colors.push(
			`#${gray.toString(16).padStart(2, "0")}${gray.toString(16).padStart(2, "0")}${gray.toString(16).padStart(2, "0")}`,
		);
	}
	return colors;
};

const colorPalette = generate256Colors();

const serializeToAnsi = (nodes: Descendant[], lang: Language): string => {
	let result = "";
	const escape = lang.escapeChar;

	const getSgr = (
		bold?: boolean,
		italic?: boolean,
		underline?: boolean,
		fg?: number,
		bg?: number,
	): string => {
		const codes: number[] = [];
		if (bold) codes.push(1);
		if (italic) codes.push(3);
		if (underline) codes.push(4);
		if (fg !== undefined) codes.push(38, 5, fg);
		if (bg !== undefined) codes.push(48, 5, bg);
		if (codes.length === 0) return "";
		return `${escape}[${codes.join(";")}m`;
	};

	for (const node of nodes) {
		if ("type" in node && node.type === "paragraph") {
			for (const child of node.children) {
				if (Text.isText(child)) {
					const { text, bold, italic, underline, fg, bg } = child;
					const sgr = getSgr(bold, italic, underline, fg, bg);
					result += sgr ? sgr + text : text;
				}
			}
			result += `${escape}[0m\n`;
		}
	}
	return result.trimEnd();
};

interface MarkButtonProps {
	format: "bold" | "italic" | "underline";
	icon: React.ReactNode;
}

const MarkButton: React.FC<MarkButtonProps> = ({ format, icon }) => {
	const editor = useSlate();
	const marks = Editor.marks(editor);
	const isActive = marks?.[format] === true;

	return (
		<button
			className={`toolbar-btn ${isActive ? "active" : ""}`}
			onMouseDown={(e) => {
				e.preventDefault();
				editor.addMark(format, !isActive);
			}}
		>
			{icon}
		</button>
	);
};

const ColorButton: React.FC<{ type: "fg" | "bg"; icon: React.ReactNode }> = ({
	type,
	icon,
}) => {
	const editor = useSlate();
	const [showPalette, setShowPalette] = useState(false);
	const marks = Editor.marks(editor);
	const currentColor = marks?.[type] as number | undefined;

	const handleSelect = (index: number) => {
		editor.addMark(type, index);
		setShowPalette(false);
	};

	return (
		<div className="color-btn-wrapper">
			<button
				className="toolbar-btn"
				onMouseDown={(e) => {
					e.preventDefault();
					setShowPalette(!showPalette);
				}}
			>
				{icon}
				{currentColor !== undefined && (
					<span
						className="color-indicator"
						style={{ backgroundColor: colorPalette[currentColor] }}
					/>
				)}
			</button>
			{showPalette && (
				<div
					className="color-palette-overlay"
					onClick={() => setShowPalette(false)}
				>
					<div className="color-palette" onClick={(e) => e.stopPropagation()}>
						<div className="palette-header">
							<span>256 色</span>
							<button onClick={() => setShowPalette(false)}>✕</button>
						</div>
						<div className="color-grid">
							{colorPalette.map((color, idx) => (
								<div
									key={idx}
									className="color-swatch"
									style={{ backgroundColor: color }}
									title={`${idx}`}
									onClick={() => handleSelect(idx)}
								/>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

const ClearFormatButton: React.FC = () => {
	const editor = useSlate();
	return (
		<button
			className="toolbar-btn"
			onMouseDown={(e) => {
				e.preventDefault();
				Editor.removeMark(editor, "bold");
				Editor.removeMark(editor, "italic");
				Editor.removeMark(editor, "underline");
				Editor.removeMark(editor, "fg");
				Editor.removeMark(editor, "bg");
			}}
		>
			<MdClear size={20} />
		</button>
	);
};

const LanguageSelect: React.FC<{
	value: Language;
	onChange: (lang: Language) => void;
}> = ({ value, onChange }) => {
	return (
		<select
			className="language-select"
			value={value.name}
			onChange={(e) => {
				const selected = languages.find((l) => l.name === e.target.value);
				if (selected) onChange(selected);
			}}
		>
			{languages.map((lang) => (
				<option key={lang.name} value={lang.name}>
					{lang.name}
				</option>
			))}
		</select>
	);
};

const Leaf: React.FC<RenderLeafProps> = ({ attributes, children, leaf }) => {
	const style: React.CSSProperties = {};
	if (leaf.bold) style.fontWeight = "bold";
	if (leaf.italic) style.fontStyle = "italic";
	if (leaf.underline) style.textDecoration = "underline";
	if (leaf.fg !== undefined) style.color = colorPalette[leaf.fg];
	if (leaf.bg !== undefined) style.backgroundColor = colorPalette[leaf.bg];

	return (
		<span {...attributes} style={style}>
			{children}
		</span>
	);
};

const initialValue: Descendant[] = [
	{
		type: "paragraph",
		children: [{ text: "Hello World!" }],
	},
];

const TerminalRichEditor: React.FC = () => {
	const [language, setLanguage] = useState<Language>(languages[0]);
	const [output, setOutput] = useState("");
	const editor = useMemo(() => withHistory(withReact(createEditor())), []);

	const handleChange = useCallback(
		(value: Descendant[]) => {
			setOutput(serializeToAnsi(value, language));
		},
		[language],
	);

	const handleLanguageChange = (lang: Language) => {
		setLanguage(lang);
		setOutput(serializeToAnsi(editor.children, lang));
	};

	return (
		<div className="editor-container">
			<Slate
				editor={editor}
				initialValue={initialValue}
				onChange={handleChange}
			>
				<div className="toolbar card">
					<MarkButton format="bold" icon={<MdFormatBold size={20} />} />
					<MarkButton format="italic" icon={<MdFormatItalic size={20} />} />
					<MarkButton
						format="underline"
						icon={<MdFormatUnderlined size={20} />}
					/>
					<div className="toolbar-divider" />
					<ColorButton type="fg" icon={<MdFormatColorText size={20} />} />
					<ColorButton type="bg" icon={<MdFormatColorFill size={20} />} />
					<ClearFormatButton />
					<div className="toolbar-spacer" />

					<LanguageSelect value={language} onChange={handleLanguageChange} />
					<button
						className="github"
						onClick={() => {
							location.href =
								"https://github.com/LaughingNailoong/terminal-text-edit";
						}}
					>
						<BsGithub></BsGithub>
					</button>
				</div>

				<div className="editor-wrapper card">
					<Editable
						className="editor"
						renderLeaf={(props) => <Leaf {...props} />}
						placeholder="输入文本，应用样式..."
					/>
				</div>
			</Slate>

			<div className="output-preview card">
				<div className="output-header">
					<span>输出 ({language.name})</span>
					<button
						className="copy-btn"
						onClick={() => {
							navigator.clipboard?.writeText(output);
						}}
					>
						<MdContentCopy size={18} />
					</button>
				</div>
				<pre className="output-content">{output}</pre>
			</div>
		</div>
	);
};

export default TerminalRichEditor;
