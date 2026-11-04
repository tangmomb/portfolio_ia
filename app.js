// Lightbox des mosaïques : sans JS, chaque vignette reste un simple lien vers son image.
const dialog = document.getElementById("lightbox");
const image = document.getElementById("lightbox-image");
const caption = document.getElementById("lightbox-caption");
const counter = document.getElementById("lightbox-counter");

let items = [];
let index = 0;

function show(next) {
  index = (next + items.length) % items.length;
  const tile = items[index];
  image.src = tile.href;
  image.alt = tile.querySelector("img").alt;
  caption.textContent = tile.closest(".mosaic-item").querySelector("figcaption").textContent;
  counter.textContent = `${index + 1} / ${items.length}`;
}

document.addEventListener("click", (event) => {
  const tile = event.target.closest(".mosaic a.tile");
  if (!tile || event.ctrlKey || event.metaKey || event.shiftKey) return;
  event.preventDefault();
  items = [...tile.closest(".mosaic").querySelectorAll("a.tile")];
  dialog.classList.toggle("is-single", items.length < 2);
  show(items.indexOf(tile));
  dialog.showModal();
});

document.getElementById("lightbox-prev").addEventListener("click", () => show(index - 1));
document.getElementById("lightbox-next").addEventListener("click", () => show(index + 1));
document.getElementById("lightbox-close").addEventListener("click", () => dialog.close());

dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

dialog.addEventListener("keydown", (event) => {
  if (items.length < 2) return;
  if (event.key === "ArrowLeft") show(index - 1);
  if (event.key === "ArrowRight") show(index + 1);
});

dialog.addEventListener("close", () => image.removeAttribute("src"));
