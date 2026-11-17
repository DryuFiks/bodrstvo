// Озвучка средствами браузера (Web Speech API), без сети и сторонних сервисов.
// Читает блоки [data-speak]: текст берётся из элементов [data-say], фрагменты с lang="en" читает английский голос.
(function () {
  var bar = document.getElementById("speakbar");
  var note = document.getElementById("sp-note");
  var synth = window.speechSynthesis;
  if (!bar) return;
  if (!synth || typeof SpeechSynthesisUtterance === "undefined") {
    bar.hidden = true;
    if (note) { note.hidden = false; }
    return;
  }

  var allBtn = document.getElementById("sp-all");
  var pauseBtn = document.getElementById("sp-pause");
  var stopBtn = document.getElementById("sp-stop");
  var rateSel = document.getElementById("sp-rate");
  // На страницах книг русского выбора нет, на страницах упражнений нет английского: недостающий заменяем пустым.
  var voiceSel = document.getElementById("sp-voice") || document.createElement("select");
  var voiceEnSel = document.getElementById("sp-voice-en") || document.createElement("select");
  var hasRuSel = !!document.getElementById("sp-voice");
  var cardBtns = Array.prototype.slice.call(document.querySelectorAll(".speak-btn"));
  var KEY = "bodr-speak";

  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { saved = {}; }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        rate: rateSel.value,
        voice: voiceSel.value || saved.voice,
        voiceEn: voiceEnSel.value || saved.voiceEn
      }));
    } catch (e) {}
  }

  var voices = [];
  function byLang(prefix) {
    return voices.filter(function (v) { return (v.lang || "").toLowerCase().replace("_", "-").indexOf(prefix) === 0; });
  }
  function nice(v) { return /natural|online|google/i.test(v.name) ? 0 : 1; }

  function loadVoices() {
    voices = synth.getVoices();
    var ru = byLang("ru").sort(function (a, b) { return nice(a) - nice(b); });
    var prev = voiceSel.value || saved.voice;
    voiceSel.innerHTML = "";
    ru.forEach(function (v) {
      var o = document.createElement("option");
      o.value = v.name;
      o.textContent = v.name;
      voiceSel.appendChild(o);
    });
    if (prev) { voiceSel.value = prev; }
    if (!voiceSel.value && ru.length) { voiceSel.selectedIndex = 0; }

    var en = byLang("en").sort(function (a, b) { return nice(a) - nice(b); });
    var prevEn = voiceEnSel.value || saved.voiceEn;
    voiceEnSel.innerHTML = "";
    en.forEach(function (v) {
      var o = document.createElement("option");
      o.value = v.name;
      o.textContent = v.name;
      voiceEnSel.appendChild(o);
    });
    if (prevEn) { voiceEnSel.value = prevEn; }
    if (!voiceEnSel.value && en.length) { voiceEnSel.selectedIndex = 0; }

    // Подсказка про голос: на страницах книг нужен английский, на остальных русский.
    if (note) {
      var missing = hasRuSel ? ru.length === 0 : en.length === 0;
      note.hidden = !missing || voices.length === 0;
    }
  }
  loadVoices();
  if (synth.addEventListener) { synth.addEventListener("voiceschanged", loadVoices); }
  if (saved.rate) { rateSel.value = saved.rate; }

  function ruVoice() {
    var list = byLang("ru");
    for (var i = 0; i < list.length; i++) { if (list[i].name === voiceSel.value) return list[i]; }
    return list[0] || null;
  }
  function enVoice() {
    var list = byLang("en").sort(function (a, b) { return nice(a) - nice(b); });
    for (var i = 0; i < list.length; i++) { if (list[i].name === voiceEnSel.value) return list[i]; }
    return list[0] || null;
  }

  // Текст блока: список фрагментов {t, lang}
  function segments(root) {
    var out = [];
    (function walk(n, lang) {
      for (var c = n.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) {
          var t = c.nodeValue.replace(/\s+/g, " ").trim();
          if (!t) continue;
          if (out.length && /^[.,;:!?…)»]+$/.test(t)) { out[out.length - 1].t += t; } else { out.push({ t: t, lang: lang }); }
        } else if (c.nodeType === 1) {
          walk(c, c.getAttribute("lang") || lang);
        }
      }
    })(root, ((root.closest("[lang]") || document.documentElement).getAttribute("lang") || "ru").slice(0, 2));
    return out;
  }
  // Режем на куски до 180 знаков: длинные реплики в Chrome обрываются на 15 секундах.
  function chunks(t) {
    var parts = t.match(/[^.!?…]+[.!?…]*\s*/g) || [t];
    var out = [], cur = "";
    parts.forEach(function (p) {
      if (cur && (cur + p).length > 180) { out.push(cur); cur = p; } else { cur += p; }
    });
    if (cur) out.push(cur);
    return out;
  }
  // Цифры и сокращения в слова, чтобы голос не читал «×» и «60–90 с» по символам.
  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    return m10 === 1 && m100 !== 11 ? one : (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) ? few : many;
  }
  var END = "(?=[\\s.,;:!?…)»]|$)";
  function speakText(t) {
    t = t.replace(new RegExp("(\\d+)\\s*×\\s*(\\d+)(?:[–-](\\d+))?(\\s*(?:секунд|с))?" + END, "g"), function (m, n, a, b, sec) {
      var top = +(b || a);
      var unit = sec ? plural(top, "секунда", "секунды", "секунд") : plural(top, "повторение", "повторения", "повторений");
      return n + " " + plural(+n, "подход", "подхода", "подходов") + (b ? ", от " + a + " до " + b : " по " + a) + " " + unit;
    });
    t = t.replace(/([Чч]ерез\s+)(\d+)[–-](\d+)/g, "$1$2 или $3");
    t = t.replace(/([Пп]о\s+)?(\d+(?:,\d+)?)[–-](\d+(?:,\d+)?)/g, function (m, po, a, b) {
      return (po && po.charAt(0) === "П" ? "От " : "от ") + a + " до " + b;
    });
    // после «до» нужна форма родительного падежа: «от 2 до 3 минут»
    t = t.replace(new RegExp("(до\\s+)?(\\d+)\\s*мин" + END, "g"), function (m, to, n) {
      return (to || "") + n + " " + (to ? "минут" : plural(+n, "минута", "минуты", "минут"));
    });
    t = t.replace(new RegExp("(до\\s+)?(\\d+)\\s*с" + END, "g"), function (m, to, n) {
      return (to || "") + n + " " + (to ? "секунд" : plural(+n, "секунда", "секунды", "секунд"));
    });
    t = t.replace(new RegExp("(\\d+(?:,\\d+)?)\\s*г" + END, "g"), function (m, n) {
      return n + " " + (n.indexOf(",") >= 0 ? "грамма" : plural(+n, "грамм", "грамма", "граммов"));
    });
    t = t.replace(new RegExp(" кг" + END, "g"), " килограмм");
    return t.replace(/ккал/g, "килокалорий");
  }
  // Элементы [data-say] внутри root, в порядке документа; каждый привязан к ближайшему блоку [data-speak].
  function itemsOf(root) {
    var items = [];
    var els = Array.prototype.slice.call(root.querySelectorAll("[data-say]"));
    if (root.hasAttribute && root.hasAttribute("data-say")) { els.unshift(root); }
    function add(node, unit) {
      var segs = segments(node);
      if (!segs.length) return;
      var last = segs[segs.length - 1];
      if (!/[.!?…:;]$/.test(last.t)) { last.t += "."; }
      segs.forEach(function (s) {
        chunks(s.lang === "en" ? s.t : speakText(s.t)).forEach(function (c) { items.push({ t: c, lang: s.lang, el: unit }); });
      });
    }
    els.forEach(function (el) {
      // В книгах абзац разбит на предложения (.s): подсвечивается и читается предложение, а не весь абзац.
      var sents = el.querySelectorAll(".s");
      if (sents.length) {
        Array.prototype.forEach.call(sents, function (sp) { add(sp, sp); });
      } else {
        add(el, el.hasAttribute("data-unit") ? el : (el.closest("[data-speak]") || el));
      }
    });
    return items;
  }

  var queue = [], idx = 0, token = 0, active = null, root = null, playing = false, paused = false, allMode = false;

  // Подписи кнопок. Переключатель RU/EN есть только на странице, где заданы data-en и кнопки [data-lang].
  var T = {
    ru: { all: "▶ Слушать всё", allOn: "■ Остановить", pause: "⏸ Пауза", resume: "▶ Продолжить", stop: "■ Стоп", listen: "▶ Слушать" },
    en: { all: "▶ Listen to all", allOn: "■ Stop all", pause: "⏸ Pause", resume: "▶ Resume", stop: "■ Stop", listen: "▶ Listen" }
  };
  var langBtns = Array.prototype.slice.call(document.querySelectorAll("[data-lang]"));
  var swaps = Array.prototype.slice.call(document.querySelectorAll("[data-en]"));
  var LKEY = "bodr-lang";
  var uiLang = "ru";
  if (langBtns.length) {
    try { uiLang = localStorage.getItem(LKEY) === "en" ? "en" : "ru"; } catch (e) { uiLang = "ru"; }
  }

  function render() {
    var s = T[uiLang];
    allBtn.textContent = playing && allMode ? s.allOn : s.all;
    pauseBtn.disabled = !playing;
    stopBtn.disabled = !playing;
    stopBtn.textContent = s.stop;
    pauseBtn.textContent = paused ? s.resume : s.pause;
    cardBtns.forEach(function (b) {
      var on = playing && !allMode && b.closest("[data-speak]") === root;
      b.textContent = on ? s.stop : s.listen;
    });
  }
  // Подмена текста: русский оригинал запоминается, английский берётся из data-en.
  function applyLang() {
    swaps.forEach(function (el) {
      if (el._ru === undefined) { el._ru = el.innerHTML; }
      if (uiLang === "en") {
        el.textContent = el.getAttribute("data-en");
        el.setAttribute("lang", "en");
      } else {
        el.innerHTML = el._ru;
        el.removeAttribute("lang");
      }
    });
    langBtns.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-lang") === uiLang)); });
    document.documentElement.setAttribute("data-ui", uiLang);
    render();
  }
  function mark(el) {
    if (active) { active.classList.remove("speaking"); }
    active = el;
    if (el) {
      el.classList.add("speaking");
      if (el.scrollIntoView) { el.scrollIntoView({ block: "nearest" }); }
    }
  }
  function stop() {
    token++;
    queue = []; idx = 0; root = null; playing = false; paused = false; allMode = false;
    synth.cancel();
    mark(null);
    render();
  }
  function run(my) {
    if (my !== token) return;
    if (idx >= queue.length) { stop(); return; }
    var q = queue[idx++];
    if (q.el !== active) { mark(q.el); render(); }
    var u = new SpeechSynthesisUtterance(q.t);
    var v = q.lang === "en" ? enVoice() : ruVoice();
    u.lang = q.lang === "en" ? "en-US" : "ru-RU";
    if (v) { u.voice = v; u.lang = v.lang; }
    u.rate = parseFloat(rateSel.value) || 1;
    u.onend = function () { run(my); };
    u.onerror = function (e) {
      if (my !== token) return;
      if (e.error === "interrupted" || e.error === "canceled") return;
      stop();
    };
    synth.speak(u);
  }
  function play(items, all, block) {
    stop();
    if (!items.length) return;
    if (synth.paused) { synth.resume(); }
    queue = items; idx = 0; root = block; playing = true; allMode = all;
    render();
    run(token);
  }

  allBtn.addEventListener("click", function () {
    if (playing && allMode) { stop(); return; }
    play(itemsOf(document), true, null);
  });
  cardBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      var block = b.closest("[data-speak]");
      if (playing && !allMode && root === block) { stop(); return; }
      play(itemsOf(block), false, block);
    });
  });
  pauseBtn.addEventListener("click", function () {
    if (!playing) return;
    if (paused) { synth.resume(); } else { synth.pause(); }
    paused = !paused;
    render();
  });
  stopBtn.addEventListener("click", stop);
  rateSel.addEventListener("change", save);
  voiceSel.addEventListener("change", save);
  voiceEnSel.addEventListener("change", save);

  // Книги: щелчок по предложению или заголовку запускает чтение с этого места до конца главы.
  if (document.body.classList.contains("reader")) {
    document.addEventListener("click", function (e) {
      if (e.target.closest("a, button, select, summary, details")) return;
      var sel = window.getSelection && window.getSelection();
      if (sel && String(sel).length) return;
      var unit = e.target.closest(".s, [data-unit]");
      if (!unit) return;
      var all = itemsOf(document), from = -1;
      for (var i = 0; i < all.length; i++) { if (all[i].el === unit) { from = i; break; } }
      if (from >= 0) { play(all.slice(from), true, null); }
    });
  }
  langBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      var next = b.getAttribute("data-lang") === "en" ? "en" : "ru";
      if (next === uiLang) return;
      stop();
      uiLang = next;
      try { localStorage.setItem(LKEY, uiLang); } catch (e) {}
      applyLang();
    });
  });
  window.addEventListener("pagehide", function () { synth.cancel(); });
  if (langBtns.length) { applyLang(); } else { render(); }
})();
