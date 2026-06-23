import { store } from "../../store";
import HTMLEditor from "./HTMLEditor";
import JSXEditor from "./JSXEditor";
import OxpeckerEditor from "./OxpeckerEditor";

const paneBorder = "border-#CFCFCF dark:border-#555";

const SplitEditor = () => {
  return (
    <div
      id="split-editor"
      class="flex-grow flex min-h-0 md:flex-row md:h-[100vh] dark:bg-dark"
      classList={{
        "flex-row": store.layout === "columns",
        "flex-col": store.layout === "rows",
      }}
    >
      <div
        id="html-editor-container"
        class={`relative flex-1 min-w-0 min-h-0 md:border-r-2 ${paneBorder}`}
        classList={{
          hidden: store.layout === "jsx" || store.layout === "oxpecker",
          "border-r-2": store.layout === "columns",
          "border-b-2": store.layout === "rows",
        }}
      >
        <HTMLEditor />
      </div>
      <div
        id="jsx-editor-container"
        class={`relative flex-1 min-w-0 min-h-0 md:border-r-2 ${paneBorder}`}
        classList={{
          hidden: store.layout === "html" || store.layout === "oxpecker",
          "border-r-2": store.layout === "columns",
          "border-b-2": store.layout === "rows",
        }}
      >
        <JSXEditor />
      </div>
      <div
        id="oxpecker-editor-container"
        class="relative flex-1 min-w-0 min-h-0"
        classList={{
          hidden: store.layout === "html" || store.layout === "jsx",
        }}
      >
        <OxpeckerEditor />
      </div>
    </div>
  );
};

export default SplitEditor;
