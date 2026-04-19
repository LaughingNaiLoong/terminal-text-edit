import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import RichTextEditor from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<RichTextEditor></RichTextEditor>
	</StrictMode>,
);
