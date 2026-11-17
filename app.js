(function () {
  var KEY = "bodr-" + location.pathname.split("/").pop() + "-" + new Date().toISOString().slice(0, 10);
  var boxes = Array.prototype.slice.call(document.querySelectorAll('.block-head input[type="checkbox"]'));
  var tabs = Array.prototype.slice.call(document.querySelectorAll("#strip a"));
  var out = document.getElementById("progress");
  var state = {};
  try { state = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { state = {}; }

  function render() {
    var n = 0;
    boxes.forEach(function (b) {
      var on = !!state[b.dataset.b];
      b.checked = on;
      if (on) n++;
    });
    tabs.forEach(function (t) { t.classList.toggle("done", !!state[t.dataset.b]); });
    if (!out) return;
    out.textContent = n === 0 ? "Отмечайте блоки по мере выполнения."
      : n === boxes.length ? "Все блоки сделаны. Отлично."
      : "Сделано " + n + " из " + boxes.length + ".";
  }
  boxes.forEach(function (b) {
    b.addEventListener("change", function () {
      state[b.dataset.b] = b.checked;
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
      render();
    });
  });
  render();
})();
