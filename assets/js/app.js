(() => {
  "use strict";

  const payload = window.SEEDANCE_PROMPTS;
  if (!payload || !Array.isArray(payload.prompts)) {
    throw new Error("Prompt data is missing. Run scripts/build_prompt_data.py first.");
  }

  const prompts = payload.prompts;
  const upstream = payload.meta.upstream;
  const state = {
    lang: localStorage.getItem("seedance-archive-lang") || (navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en"),
    filter: "all",
    query: "",
    activePrompt: null,
    modalLang: "zh"
  };

  const filters = [
    { id: "all", label: { zh: "全部", en: "All" } },
    { id: "featured", label: { zh: "精选", en: "Featured" } },
    { id: "film", label: { zh: "影视", en: "Film" } },
    { id: "advertising", label: { zh: "广告", en: "Advertising" } },
    { id: "vfx", label: { zh: "视效", en: "VFX" } },
    { id: "reference", label: { zh: "参考生成", en: "Reference" } },
    { id: "editing", label: { zh: "视频编辑", en: "Editing" } },
    { id: "gaming", label: { zh: "游戏", en: "Gaming" } },
    { id: "explainer", label: { zh: "科普", en: "Explainer" } }
  ];

  const ui = {
    zh: {
      copied: "提示词已复制",
      copyFailed: "复制失败，请手动选择文本",
      openPrompt: "打开提示词",
      copyShort: "复制",
      references: "个参考素材",
      noRefs: "纯提示词",
      promptLanguage: "提示词语言",
      close: "关闭",
      search: "搜索提示词、标题或场景…",
      results: "个结果",
      activeFilterLabel: "提示词筛选",
      sourceFallback: "Seedance 2.5 / 火山方舟"
    },
    en: {
      copied: "Prompt copied to clipboard",
      copyFailed: "Copy failed. Select the prompt manually.",
      openPrompt: "Open prompt",
      copyShort: "Copy",
      references: "references",
      noRefs: "Prompt only",
      promptLanguage: "Prompt language",
      close: "Close",
      search: "Search prompts, titles, or scenes…",
      results: "results",
      activeFilterLabel: "Prompt filters",
      sourceFallback: "Seedance 2.5 / Volcano Ark"
    }
  };

  const el = {
    grid: document.getElementById("prompt-grid"),
    filterRow: document.getElementById("filter-row"),
    search: document.getElementById("search-input"),
    count: document.getElementById("result-count"),
    reset: document.getElementById("reset-filters"),
    empty: document.getElementById("empty-state"),
    emptyReset: document.getElementById("empty-reset"),
    langToggle: document.getElementById("lang-toggle"),
    dialog: document.getElementById("prompt-dialog"),
    dialogClose: document.getElementById("dialog-close"),
    modalImage: document.getElementById("modal-image"),
    modalNumber: document.getElementById("modal-number"),
    modalAspect: document.getElementById("modal-aspect"),
    modalCategory: document.getElementById("modal-category"),
    modalReferences: document.getElementById("modal-references"),
    modalTitle: document.getElementById("modal-title"),
    modalDescription: document.getElementById("modal-description"),
    modalPrompt: document.getElementById("modal-prompt"),
    modalCopy: document.getElementById("modal-copy"),
    modalSource: document.getElementById("modal-source"),
    modalSourceLabel: document.getElementById("modal-source-label"),
    modalVideo: document.getElementById("modal-video"),
    toast: document.getElementById("toast")
  };

  let toastTimer;
  let lastFocusedElement = null;

  const normalize = (value) => String(value || "")
    .toLocaleLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();

  const escapeHtml = (value) => String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const formatNumber = (number) => String(number).padStart(3, "0");

  function promptMatchesFilter(item, filterId) {
    if (filterId === "all") return true;
    if (filterId === "featured") return item.featured;
    if (filterId === "film") return item.scene.zh === "影视";
    if (filterId === "advertising") return item.scene.zh === "广告";
    if (filterId === "vfx") return item.scene.zh === "视效" || item.scene.zh === "后期";
    if (filterId === "reference") return item.category.zh === "参考生成";
    if (filterId === "editing") return item.category.zh === "视频编辑";
    if (filterId === "gaming") return item.scene.zh === "游戏";
    if (filterId === "explainer") return item.scene.zh === "科普";
    return true;
  }

  function promptMatchesQuery(item, query) {
    if (!query) return true;
    const searchable = [
      item.title.zh,
      item.title.en,
      item.description.zh,
      item.description.en,
      item.prompt.zh,
      item.prompt.en,
      item.category.zh,
      item.category.en,
      item.scene.zh,
      item.scene.en,
      ...item.tags.zh,
      ...item.tags.en
    ].join(" ");
    return normalize(searchable).includes(query);
  }

  function getVisiblePrompts() {
    return prompts.filter((item) => (
      promptMatchesFilter(item, state.filter) && promptMatchesQuery(item, state.query)
    ));
  }

  function countForFilter(filterId) {
    return prompts.filter((item) => promptMatchesFilter(item, filterId)).length;
  }

  function metaParts(item) {
    const parts = [item.category[state.lang]];
    if (item.scene[state.lang]) parts.push(item.scene[state.lang]);
    if (item.aspect && item.aspect !== "0") parts.push(item.aspect);
    return parts.filter(Boolean);
  }

  function copyIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="1.5"></rect><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"></path></svg>';
  }

  function renderFilters() {
    el.filterRow.setAttribute("aria-label", ui[state.lang].activeFilterLabel);
    el.filterRow.innerHTML = filters.map((filter) => {
      const active = state.filter === filter.id;
      return `
        <button class="filter-chip${active ? " is-active" : ""}" type="button"
          data-filter="${filter.id}" aria-pressed="${active}">
          ${escapeHtml(filter.label[state.lang])}
          <span class="count">${countForFilter(filter.id)}</span>
        </button>`;
    }).join("");
  }

  function cardTemplate(item, index) {
    const title = item.title[state.lang];
    const description = item.description[state.lang];
    const category = item.category[state.lang];
    const tag = item.tags[state.lang][0] || category;
    const meta = metaParts(item);
    const loadMode = index < 3 ? "eager" : "lazy";
    const fetchPriority = index < 2 ? ' fetchpriority="high"' : "";

    return `
      <article class="prompt-card${item.featured ? " is-featured" : ""}" data-id="${item.id}" aria-labelledby="card-title-${item.id}">
        <div class="card-media">
          <img src="${escapeHtml(item.image)}" alt="${escapeHtml(title)}" loading="${loadMode}" decoding="async"${fetchPriority}>
          <span class="card-number">NO. ${formatNumber(item.id)}</span>
          ${item.featured ? `<span class="card-featured">${state.lang === "zh" ? "精选" : "FEATURED"}</span>` : ""}
          <button class="card-open" type="button" data-open="${item.id}" aria-label="${escapeHtml(ui[state.lang].openPrompt)}">↗</button>
        </div>
        <div class="card-body">
          <div class="card-meta">${meta.map((part) => `<span>${escapeHtml(part)}</span>`).join("")}</div>
          <h3 class="card-title" id="card-title-${item.id}">${escapeHtml(title)}</h3>
          <p class="card-description">${escapeHtml(description)}</p>
          <div class="card-footer">
            <span class="card-tag">${escapeHtml(tag)}</span>
            <button class="card-copy" type="button" data-copy="${item.id}" aria-label="${escapeHtml(ui[state.lang].copyShort)} ${escapeHtml(title)}">
              ${copyIcon()}${escapeHtml(ui[state.lang].copyShort)}
            </button>
          </div>
        </div>
      </article>`;
  }

  function renderCards() {
    const visible = getVisiblePrompts();
    el.grid.innerHTML = visible.map(cardTemplate).join("");
    el.count.textContent = String(visible.length);
    el.empty.hidden = visible.length !== 0;
    el.grid.hidden = visible.length === 0;
    const isFiltered = state.filter !== "all" || Boolean(state.query);
    el.reset.hidden = !isFiltered;
    document.querySelector(".results-meta p span:last-child").textContent = ui[state.lang].results;
  }

  function setLanguage(lang) {
    state.lang = lang === "en" ? "en" : "zh";
    localStorage.setItem("seedance-archive-lang", state.lang);
    document.documentElement.lang = state.lang === "zh" ? "zh-CN" : "en";
    document.title = state.lang === "zh"
      ? "Seedance 2.5 Prompt Archive — 24 个电影级视频提示词"
      : "Seedance 2.5 Prompt Archive — 24 Cinematic Video Prompts";

    document.querySelectorAll("[data-zh][data-en]").forEach((node) => {
      node.textContent = node.dataset[state.lang];
    });

    el.search.placeholder = state.lang === "zh"
      ? el.search.dataset.zhPlaceholder
      : el.search.dataset.enPlaceholder;
    el.langToggle.innerHTML = state.lang === "zh"
      ? '<span class="lang-active">中</span><span class="lang-sep">/</span><span class="lang-idle">EN</span>'
      : '<span class="lang-idle">中</span><span class="lang-sep">/</span><span class="lang-active">EN</span>';
    el.langToggle.setAttribute("aria-label", state.lang === "zh" ? "Switch to English" : "切换为中文");
    el.dialogClose.setAttribute("aria-label", ui[state.lang].close);
    el.dialog.querySelector(".language-tabs").setAttribute("aria-label", ui[state.lang].promptLanguage);

    renderFilters();
    renderCards();

    if (state.activePrompt && el.dialog.open) {
      state.modalLang = state.lang;
      renderModal(state.activePrompt);
    }
  }

  function renderModal(item) {
    const lang = state.modalLang;
    el.modalImage.src = item.image;
    el.modalImage.alt = item.title[state.lang];
    el.modalNumber.textContent = `NO. ${formatNumber(item.id)} / 024`;
    el.modalAspect.textContent = item.aspect || "FREE FORMAT";
    el.modalCategory.textContent = item.category[state.lang];
    el.modalReferences.textContent = item.references
      ? `${item.references} ${ui[state.lang].references}`
      : ui[state.lang].noRefs;
    el.modalTitle.textContent = item.title[state.lang];
    el.modalDescription.textContent = item.description[state.lang];
    el.modalPrompt.textContent = item.prompt[lang];
    el.modalSource.href = item.source || upstream;
    el.modalSourceLabel.textContent = item.sourceLabel || ui[state.lang].sourceFallback;
    el.modalVideo.hidden = !item.inputVideo;
    if (item.inputVideo) el.modalVideo.href = item.inputVideo;

    el.dialog.querySelectorAll("[data-prompt-lang]").forEach((button) => {
      const active = button.dataset.promptLang === lang;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
  }

  function openPrompt(item) {
    if (!item) return;
    lastFocusedElement = document.activeElement;
    state.activePrompt = item;
    state.modalLang = state.lang;
    renderModal(item);
    if (!el.dialog.open) el.dialog.showModal();
    document.body.classList.add("modal-open");
    history.replaceState({ prompt: item.slug }, "", `#${item.slug}`);
    el.modalPrompt.scrollTop = 0;
  }

  function closePrompt() {
    if (el.dialog.open) el.dialog.close();
  }

  function clearPromptHash() {
    if (prompts.some((item) => item.slug === location.hash.slice(1))) {
      history.replaceState(null, "", `${location.pathname}${location.search}#library`);
    }
  }

  async function copyText(text, message) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand("copy");
        textarea.remove();
        if (!ok) throw new Error("execCommand copy failed");
      }
      showToast(message || ui[state.lang].copied);
    } catch (error) {
      console.error(error);
      showToast(ui[state.lang].copyFailed);
    }
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    el.toast.textContent = message;
    el.toast.classList.add("is-visible");
    toastTimer = setTimeout(() => el.toast.classList.remove("is-visible"), 2100);
  }

  function resetFilters() {
    state.filter = "all";
    state.query = "";
    el.search.value = "";
    renderFilters();
    renderCards();
    el.search.focus();
  }

  el.filterRow.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    state.filter = button.dataset.filter;
    renderFilters();
    renderCards();
  });

  el.search.addEventListener("input", () => {
    state.query = normalize(el.search.value);
    renderCards();
  });

  el.grid.addEventListener("click", (event) => {
    const copyButton = event.target.closest("[data-copy]");
    if (copyButton) {
      event.stopPropagation();
      const item = prompts.find((prompt) => prompt.id === Number(copyButton.dataset.copy));
      if (item) copyText(item.prompt[state.lang]);
      return;
    }

    const openButton = event.target.closest("[data-open]");
    const card = event.target.closest(".prompt-card");
    if (openButton || card) {
      const id = Number((openButton || card).dataset.open || card.dataset.id);
      openPrompt(prompts.find((prompt) => prompt.id === id));
    }
  });

  el.reset.addEventListener("click", resetFilters);
  el.emptyReset.addEventListener("click", resetFilters);

  el.langToggle.addEventListener("click", () => {
    setLanguage(state.lang === "zh" ? "en" : "zh");
  });

  el.dialogClose.addEventListener("click", closePrompt);
  el.dialog.addEventListener("click", (event) => {
    if (event.target === el.dialog) closePrompt();
  });
  el.dialog.addEventListener("close", () => {
    document.body.classList.remove("modal-open");
    clearPromptHash();
    state.activePrompt = null;
    if (lastFocusedElement && document.contains(lastFocusedElement)) lastFocusedElement.focus();
  });

  el.dialog.querySelectorAll("[data-prompt-lang]").forEach((button) => {
    button.addEventListener("click", () => {
      state.modalLang = button.dataset.promptLang;
      if (state.activePrompt) renderModal(state.activePrompt);
    });
  });

  el.modalCopy.addEventListener("click", () => {
    if (state.activePrompt) copyText(state.activePrompt.prompt[state.modalLang]);
  });

  document.addEventListener("keydown", (event) => {
    const isTyping = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (event.key === "/" && !isTyping && !el.dialog.open) {
      event.preventDefault();
      el.search.focus();
    }
  });

  window.addEventListener("hashchange", () => {
    const slug = location.hash.slice(1);
    const item = prompts.find((prompt) => prompt.slug === slug);
    if (item && (!el.dialog.open || state.activePrompt?.slug !== item.slug)) openPrompt(item);
  });

  const initialSlug = location.hash.slice(1);
  const initialPrompt = prompts.find((prompt) => prompt.slug === initialSlug);
  setLanguage(state.lang);
  if (initialPrompt) openPrompt(initialPrompt);
})();