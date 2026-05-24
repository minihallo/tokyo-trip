const trip = window.TOKYO_TRIP;
const app = document.querySelector("#app");

let activeAlbum = null;
let activePhotoIndex = 0;

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function albumUrl(slug) {
  return `/albums/${slug}/`;
}

function currentSlug() {
  const match = window.location.pathname.match(/\/albums\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function photoLabel(album, photo, index) {
  const time = photo.date && photo.time ? `${photo.date} ${photo.time}` : photo.fileName;
  return `${album.title} ${String(index + 1).padStart(2, "0")} · ${time}`;
}

function renderHome() {
  const albums = trip.albums;
  const heroAlbum =
    albums.find((album) => album.slug === "meiji-jingu") ||
    albums.find((album) => album.cover) ||
    albums[0];

  app.innerHTML = `
    <header class="site-top">
      <a class="brand" href="/" aria-label="Tokyo Trip 홈">
        <span>Tokyo</span>
        <strong>Trip</strong>
      </a>
      <nav class="top-links" aria-label="앨범 바로가기">
        ${albums
          .slice(0, 4)
          .map((album) => `<a href="${albumUrl(album.slug)}">${escapeHtml(album.title)}</a>`)
          .join("")}
      </nav>
    </header>

    <main>
      <section class="home-hero" style="--hero-image: url('${heroAlbum.cover}')">
        <div class="hero-copy">
          <p class="eyebrow">Tokyo · May 2026</p>
          <h1>도쿄 여행 기록</h1>
          <p>${trip.totalAlbums} stops · ${trip.totalPhotos} photos</p>
        </div>
      </section>

      <section class="route-band" aria-label="여행 경로">
        ${albums
          .map(
            (album) => `
              <a class="route-chip" href="${albumUrl(album.slug)}">
                <span>${album.routeLabel}</span>
                <strong>${escapeHtml(album.title)}</strong>
              </a>
            `,
          )
          .join("")}
      </section>

      <section class="album-grid" aria-label="장소별 앨범">
        ${albums.map(renderAlbumCard).join("")}
      </section>
    </main>
  `;
}

function renderAlbumCard(album) {
  return `
    <a class="album-card" href="${albumUrl(album.slug)}">
      <img src="${album.coverThumb}" alt="${escapeHtml(album.title)} 앨범 대표 사진" loading="lazy" />
      <div class="album-card__body">
        <div>
          <p>${album.routeLabel}</p>
          <h2>${escapeHtml(album.title)}</h2>
        </div>
        <span>${album.photoCount} photos</span>
      </div>
    </a>
  `;
}

function renderAlbum(album) {
  const index = trip.albums.findIndex((item) => item.slug === album.slug);
  const previous = trip.albums[(index - 1 + trip.albums.length) % trip.albums.length];
  const next = trip.albums[(index + 1) % trip.albums.length];

  activeAlbum = album;

  app.innerHTML = `
    <header class="site-top site-top--solid">
      <a class="brand" href="/" aria-label="Tokyo Trip 홈">
        <span>Tokyo</span>
        <strong>Trip</strong>
      </a>
      <nav class="top-links" aria-label="앨범 이동">
        <a href="${albumUrl(previous.slug)}">이전</a>
        <a href="${albumUrl(next.slug)}">다음</a>
      </nav>
    </header>

    <main>
      <section class="album-hero" style="--hero-image: url('${album.cover}')">
        <div class="album-hero__copy">
          <a class="back-link" href="/">전체 경로</a>
          <p class="eyebrow">${album.routeLabel} · ${escapeHtml(album.dateRange)}</p>
          <h1>${escapeHtml(album.title)}</h1>
          <p>${escapeHtml(album.subtitle)}</p>
          <div class="album-meta">
            <span>${album.photoCount} photos</span>
            <a href="${albumUrl(previous.slug)}">${escapeHtml(previous.title)}</a>
            <a href="${albumUrl(next.slug)}">${escapeHtml(next.title)}</a>
          </div>
        </div>
      </section>

      <section class="photo-grid" aria-label="${escapeHtml(album.title)} 사진">
        ${album.photos
          .map(
            (photo, photoIndex) => `
              <button
                class="photo-tile"
                style="--ratio: ${photo.width} / ${photo.height}"
                type="button"
                data-photo-index="${photoIndex}"
                aria-label="${escapeHtml(photoLabel(album, photo, photoIndex))}"
              >
                <img
                  src="${photo.thumb}"
                  alt="${escapeHtml(photoLabel(album, photo, photoIndex))}"
                  loading="lazy"
                  width="${photo.thumbWidth}"
                  height="${photo.thumbHeight}"
                />
              </button>
            `,
          )
          .join("")}
      </section>
    </main>

    <div class="lightbox" id="lightbox" hidden>
      <button class="lightbox__close" type="button" data-lightbox-close aria-label="닫기">×</button>
      <button class="lightbox__nav lightbox__nav--previous" type="button" data-lightbox-prev aria-label="이전 사진">‹</button>
      <figure>
        <img alt="" />
        <figcaption></figcaption>
      </figure>
      <button class="lightbox__nav lightbox__nav--next" type="button" data-lightbox-next aria-label="다음 사진">›</button>
    </div>
  `;
}

function openLightbox(index) {
  activePhotoIndex = index;
  const lightbox = document.querySelector("#lightbox");
  const image = lightbox.querySelector("img");
  const caption = lightbox.querySelector("figcaption");
  const photo = activeAlbum.photos[activePhotoIndex];

  image.src = photo.src;
  image.alt = photoLabel(activeAlbum, photo, activePhotoIndex);
  caption.textContent = photoLabel(activeAlbum, photo, activePhotoIndex);
  lightbox.hidden = false;
  document.body.classList.add("is-lightbox-open");
}

function closeLightbox() {
  const lightbox = document.querySelector("#lightbox");

  if (!lightbox) {
    return;
  }

  lightbox.hidden = true;
  document.body.classList.remove("is-lightbox-open");
}

function stepLightbox(direction) {
  if (!activeAlbum) {
    return;
  }

  const nextIndex =
    (activePhotoIndex + direction + activeAlbum.photos.length) % activeAlbum.photos.length;
  openLightbox(nextIndex);
}

function bindInteractions() {
  document.addEventListener("click", (event) => {
    const tile = event.target.closest("[data-photo-index]");

    if (tile) {
      openLightbox(Number(tile.dataset.photoIndex));
      return;
    }

    if (event.target.closest("[data-lightbox-close]")) {
      closeLightbox();
      return;
    }

    if (event.target.closest("[data-lightbox-prev]")) {
      stepLightbox(-1);
      return;
    }

    if (event.target.closest("[data-lightbox-next]")) {
      stepLightbox(1);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (!document.body.classList.contains("is-lightbox-open")) {
      return;
    }

    if (event.key === "Escape") {
      closeLightbox();
    }

    if (event.key === "ArrowLeft") {
      stepLightbox(-1);
    }

    if (event.key === "ArrowRight") {
      stepLightbox(1);
    }
  });
}

function render() {
  if (!trip || !Array.isArray(trip.albums)) {
    app.innerHTML = "<main class=\"empty-state\">앨범 데이터를 찾을 수 없습니다.</main>";
    return;
  }

  const slug = currentSlug();

  if (!slug) {
    renderHome();
    return;
  }

  const album = trip.albums.find((item) => item.slug === slug);

  if (!album) {
    renderHome();
    return;
  }

  renderAlbum(album);
}

render();
bindInteractions();
