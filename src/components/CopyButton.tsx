import { writeClipboard } from "@solid-primitives/clipboard";
import { debounce } from "@solid-primitives/scheduled";
import { createSignal } from "solid-js";
import CopyIcon from "./Icons/CopyIcon";

type Props = {
  /** Label shown on the button, e.g. "JSX" -> "Copy JSX". */
  label: string;
  /** Returns the text to copy when clicked. */
  getText: () => string;
};

const CopyButton = (props: Props) => {
  const [hasCopied, setHasCopied] = createSignal(false);

  const setHasCopiedDebounced = debounce(() => setHasCopied(false), 1500);

  const onCopyClick = async () => {
    try {
      await writeClipboard(props.getText().trim());
      setHasCopied(true);
      setHasCopiedDebounced();
    } catch (err) {}
  };

  return (
    <button
      class="block mx-auto w-full max-w-300px rounded-12px bg-image-[linear-gradient(180deg,#4e88c6,#446b9e)]"
      onClick={onCopyClick}
    >
      <div class="flex justify-between items-center gap-2 px-[min(3.5vw,16px)] py-4px md:(px-20px py-6px) rounded-9px m-3px bg-solid-light text-#fff hover:(bg-#446b9e) transition">
        <span class="whitespace-nowrap TEMP">
          {hasCopied() ? "Copied!" : `Copy ${props.label}`}
        </span>{" "}
        <CopyIcon />
      </div>
    </button>
  );
};

export default CopyButton;
