export const loader = {
  show() {
    const loader = document.getElementById("global-loader");

    if (loader) {
      loader.classList.remove("hidden");
      loader.classList.add("flex");
    }
  },
  hide() {
    const loader = document.getElementById("global-loader");

    if (loader) {
      loader.classList.remove("flex");
      loader.classList.add("hidden");
    }
  },
};
