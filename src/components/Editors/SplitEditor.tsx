import { createEffect, For, Match, on, onMount, Show, Switch } from "solid-js";
import { produce } from "solid-js/store";
import { PaneKey, PANE_KEYS, setStore, store } from "../../store";
import HTMLEditor from "./HTMLEditor";
import JSXEditor from "./JSXEditor";
import OxpeckerEditor from "./OxpeckerEditor";

/** Minimum pane size (px) preserved while dragging a resizer. */
const MIN_PANE = 80;

const SplitEditor = () => {
  let containerRef: HTMLDivElement | undefined;
  const paneEls: Partial<Record<PaneKey, HTMLDivElement>> = {};

  const isColumns = () => store.orientation === "columns";
  const visiblePanes = () => PANE_KEYS.filter((p) => store.panes[p]);

  // Drag a divider: keep the two adjacent panes' combined weight constant and
  // re-split it according to the new pixel boundary, leaving other panes alone.
  const beginResize = (e: PointerEvent, leftKey: PaneKey, rightKey: PaneKey) => {
    e.preventDefault();
    const columns = isColumns();
    const leftEl = paneEls[leftKey];
    const rightEl = paneEls[rightKey];
    if (!leftEl || !rightEl) return;

    const axis = (el: HTMLDivElement) =>
      columns ? el.getBoundingClientRect().width : el.getBoundingClientRect().height;
    const leftPx0 = axis(leftEl);
    const pairPx = leftPx0 + axis(rightEl);
    const startPos = columns ? e.clientX : e.clientY;
    const weightSum = store.paneSizes[leftKey] + store.paneSizes[rightKey];

    const onMove = (ev: PointerEvent) => {
      const pos = columns ? ev.clientX : ev.clientY;
      const newLeftPx = Math.max(MIN_PANE, Math.min(pairPx - MIN_PANE, leftPx0 + (pos - startPos)));
      const newLeftWeight = (weightSum * newLeftPx) / pairPx;
      setStore("paneSizes", (sizes) => ({
        ...sizes,
        [leftKey]: newLeftWeight,
        [rightKey]: weightSum - newLeftWeight,
      }));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = columns ? "col-resize" : "row-resize";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // Persist orientation / visibility / sizes across reloads.
  onMount(() => {
    try {
      const saved = JSON.parse(localStorage.view);
      requestAnimationFrame(() =>
        setStore(
          produce((s) => {
            if (saved.orientation) s.orientation = saved.orientation;
            if (saved.panes) s.panes = { ...s.panes, ...saved.panes };
            if (saved.paneSizes) s.paneSizes = { ...s.paneSizes, ...saved.paneSizes };
          }),
        ),
      );
    } catch (err) {}
  });
  createEffect(
    on(
      () =>
        JSON.stringify({
          orientation: store.orientation,
          panes: store.panes,
          paneSizes: store.paneSizes,
        }),
      (view) => {
        try {
          localStorage.view = view;
        } catch (err) {}
      },
      { defer: true },
    ),
  );

  return (
    <div
      id="split-editor"
      ref={containerRef}
      class="flex-grow flex min-h-0 md:h-[100vh] dark:bg-dark"
      classList={{ "flex-row": isColumns(), "flex-col": !isColumns() }}
    >
      <For each={visiblePanes()}>
        {(pane, i) => (
          <>
            <Show when={i() > 0}>
              <div
                role="separator"
                aria-orientation={isColumns() ? "vertical" : "horizontal"}
                class="shrink-0 bg-#CFCFCF dark:bg-#555 hover:bg-solid-light dark:hover:bg-solid-light transition-colors touch-none"
                classList={{
                  "w-[4px] cursor-col-resize": isColumns(),
                  "h-[4px] cursor-row-resize": !isColumns(),
                }}
                onPointerDown={(e) => beginResize(e, visiblePanes()[i() - 1], pane)}
              />
            </Show>
            <div
              ref={(el) => (paneEls[pane] = el)}
              id={`${pane}-editor-container`}
              class="relative min-w-0 min-h-0"
              style={{ "flex-grow": String(store.paneSizes[pane]), "flex-basis": "0%" }}
            >
              <Switch>
                <Match when={pane === "html"}>
                  <HTMLEditor />
                </Match>
                <Match when={pane === "jsx"}>
                  <JSXEditor />
                </Match>
                <Match when={pane === "oxpecker"}>
                  <OxpeckerEditor />
                </Match>
              </Switch>
            </div>
          </>
        )}
      </For>
    </div>
  );
};

export default SplitEditor;
