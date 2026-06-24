import { StreamLanguage, StringStream } from "@codemirror/language";
import { fSharp } from "@codemirror/legacy-modes/mode/mllike";
import { tags } from "@lezer/highlight";
import { Extension } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import {
  createCodeMirror,
  createEditorControlledValue,
  createEditorReadonly,
} from "solid-codemirror";
import { $TRACK, createEffect, createSignal, on, onMount } from "solid-js";
import { editorBaseTheme } from "../../editor/editorBaseTheme";
import { vsCodeDark } from "../../editor/theme/dark";
import { githubLight } from "../../editor/theme/light";
import HTMLtoOxpecker from "../../lib/html-to-oxpecker";
import { ConfigKey, setStore, store } from "../../store";
import CopyButton from "../CopyButton";
import { isDarkTheme } from "../Header/ThemeBtn";

// The legacy F# mode tags every identifier as a plain variable, so element
// names and attribute names render in the same colour. Re-tag an identifier
// that is immediately followed by "(" (i.e. an element/function call such as
// `div(`, `circle(`, `.attr(`) as a tag name so the Oxpecker markup reads with
// the same structure as the HTML pane.
const fsharpParser = {
  ...fSharp,
  token(stream: StringStream, state: unknown) {
    const style = fSharp.token!(stream, state);
    if (style === "variable" && stream.peek() === "(") return "elementName";
    return style;
  },
  tokenTable: { ...fSharp.tokenTable, elementName: tags.tagName },
};
const fsharp = StreamLanguage.define(fsharpParser);

const OxpeckerEditor = () => {
  const [code, setCode] = createSignal(store.oxpeckerText.trimEnd());
  const { editorView, ref: setEditorRef, createExtension } = createCodeMirror();
  createEditorControlledValue(editorView, code);
  createEditorReadonly(editorView, () => true);
  let converter!: HTMLtoOxpecker;

  const extensions = (): Extension => {
    return [
      editorBaseTheme({ backgroundColor: "transparent" }),
      isDarkTheme() ? vsCodeDark : githubLight,
      lineNumbers(),
      store.lineWrap ? EditorView.lineWrapping : [],
      EditorView.contentAttributes.of({
        "aria-label": "F# Oxpecker code output",
        "aria-readonly": "true",
      }),
      fsharp,
    ];
  };

  const reconfigure = createExtension(extensions());

  const updateEditorText = () => {
    const converted = converter.convert(store.htmlText);
    const text = converted || "\n";
    setStore("oxpeckerText", text);
    setCode(text.trimEnd());
  };

  onMount(() => {
    converter = new HTMLtoOxpecker(mapConfig());
    // Refresh from the current HTML — the pane may have been hidden (and so not
    // updated by the effects below) while the input changed.
    updateEditorText();

    setTimeout(() => {
      const { scrollDOM } = editorView();
      scrollDOM.scrollTo({ top: 0 });
    });
  });

  createEffect(on(extensions, (extensions) => reconfigure(extensions)));

  createEffect(
    on(
      () => store.config[$TRACK as any as ConfigKey],
      () => {
        converter.config = mapConfig();
        updateEditorText();
      },
      { defer: true },
    ),
  );

  createEffect(
    on(
      () => store.htmlText,
      () => updateEditorText(),
      { defer: true },
    ),
  );

  return (
    <div class="grid grid-rows-[min-content_1fr_min-content] h-full">
      <div class="py-2px dark:bg-dark bg-white border-b-2 border-#f1f1f1 dark:border-#2E2E2E">
        <div class="text-#747474 dark:text-#8C8C8C font-sans text-12px md:text-16px font-500 ml-20px">
          F# <span class="ml-2 opacity-75">Oxpecker</span>
        </div>
      </div>
      <div class="relative overflow-auto">
        <div
          class="absolute inset-0"
          ref={(el) => {
            onMount(() => {
              setEditorRef(el);
            });
          }}
        />
      </div>
      <div
        id="copy-oxpecker-container"
        class="hidden md:block relative mt-auto p-10px pb-12px bg-white border-t-2 border-#CFCFCF dark:(border-#555 bg-dark) z-1"
      >
        <CopyButton label="F#" getText={() => store.oxpeckerText} />
      </div>
    </div>
  );
};

/** Maps the shared JSX-oriented config onto the options the Oxpecker converter understands. */
function mapConfig() {
  const { indent, wrapperNode, component, componentName, stripStyleTag, stripComment } =
    store.config;
  return {
    indent: indent?.replace(/\\/g, ""),
    wrapperNode,
    component,
    componentName,
    stripStyleTag,
    stripComment,
  };
}

export default OxpeckerEditor;
