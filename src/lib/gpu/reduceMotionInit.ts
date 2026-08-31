/** beforeInteractive — applies reduce-motion class before first paint (no logo flash). */
export const REDUCE_MOTION_STORAGE_KEY = "movviz-reduce-animations";

export const REDUCE_MOTION_INIT_SCRIPT = `
(function () {
  try {
    var stored = window.localStorage.getItem("${REDUCE_MOTION_STORAGE_KEY}");
    if (stored === "1") document.documentElement.classList.add("reduce-motion");
    else if (stored === "0") document.documentElement.classList.remove("reduce-motion");
  } catch (e) {}
})();
`;
