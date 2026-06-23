import { For, onMount } from "solid-js";
import { PaneKey, PANE_KEYS, setStore, store } from "../../store";
import ConfigPanel from "../ConfigPanel/ConfigPanel";
import TogglePanelButton from "./TogglePanelButton";

export const panelSize = "w-full md:w-35vw md:min-w-300px md:max-w-450px";

const PANE_LABELS: Record<PaneKey, string> = { html: "HTML", jsx: "JSX", oxpecker: "F#" };

const SettingsPanel = () => {
  // Toggle a pane, but never hide the last visible one.
  const togglePane = (key: PaneKey) => {
    const visibleCount = PANE_KEYS.filter((p) => store.panes[p]).length;
    if (store.panes[key] && visibleCount === 1) return;
    setStore("panes", key, !store.panes[key]);
  };
  onMount(() => {
    try {
      const lineWrap = JSON.parse(localStorage.lineWrap) as boolean;

      requestAnimationFrame(() => {
        setStore("lineWrap", lineWrap);
      });
    } catch (err) {}
  });
  return (
    <div
      id="settings-panel"
      class={`${panelSize} min-h-0 md:min-h-auto md:h-[calc(100%-60px)] float-right md:mt-60px md:border-r-2 border-#CFCFCF dark:border-#555 overflow-clip`}
    >
      <div class="h-full grid grid-rows-[1fr] md:grid-rows-[min-content_1fr]">
        <div class="hidden md:block">
          <TogglePanelButton />
          <div id="editor-settings" class="px-4 TEMP">
            <h2 class="text-#888 font-bold">Editors</h2>
            <div class="py-3 dark:text-light text-13px lg:text-16px">
              <div class="flex items-center justify-between gap-2">
                <span>Panes</span>
                <div class="flex gap-1">
                  <For each={PANE_KEYS}>
                    {(key) => (
                      <button
                        class="px-8px py-3px rounded-6px border-1 text-12px font-500 transition"
                        classList={{
                          "bg-solid-light text-white border-solid-light": store.panes[key],
                          "text-#888 border-#CFCFCF hover:bg-black/05 dark:(border-#555 hover:bg-white/05)":
                            !store.panes[key],
                        }}
                        aria-pressed={store.panes[key]}
                        onClick={() => togglePane(key)}
                      >
                        {PANE_LABELS[key]}
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </div>
            <div class="py-3 dark:text-light text-13px lg:text-16px">
              <div class="flex items-center justify-between gap-2">
                <span>Layout</span>
                <button
                  class="px-10px py-3px rounded-6px border-1 border-#CFCFCF dark:border-#555 text-12px font-500 hover:bg-black/05 dark:hover:bg-white/05 transition"
                  onClick={() =>
                    setStore("orientation", store.orientation === "columns" ? "rows" : "columns")
                  }
                >
                  {store.orientation === "columns" ? "Columns" : "Rows"}
                </button>
              </div>
            </div>
            <div class="py-3 dark:text-light text-13px lg:text-16px hover:bg-black/02 transition dark:hover:bg-white/02">
              <label class="flex items-center justify-between gap-2">
                <span>Line Wrap</span>
                <input
                  class="switch"
                  type="checkbox"
                  role="switch"
                  checked={store.lineWrap}
                  onChange={(e) => {
                    const checked = e.currentTarget.checked;
                    localStorage.lineWrap = checked;
                    setStore("lineWrap", checked);
                  }}
                />
              </label>
            </div>
          </div>
        </div>
        <div id="config-container" class="h-full overflow-auto">
          <ConfigPanel />
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
