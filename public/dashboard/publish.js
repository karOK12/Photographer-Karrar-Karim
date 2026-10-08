const postMedia = document.getElementById('postMedia');
const postSelectedFile = document.getElementById('postSelectedFile');
const postSection = document.getElementById('postSection');
const postSubsection = document.getElementById('postSubsection');
const postTitle = document.getElementById('postTitle');
const postContent = document.getElementById('postContent');
const publishPostButton = document.getElementById('publishPostButton');

const mediaViewer = document.getElementById('mediaViewer');
const mediaViewerOverlay = document.getElementById('mediaViewerOverlay');
const mediaViewerBack = document.getElementById('mediaViewerBack');
const mediaViewerPrev = document.getElementById('mediaViewerPrev');
const mediaViewerNext = document.getElementById('mediaViewerNext');
const mediaViewerStage = document.getElementById('mediaViewerStage');

const MAX_MEDIA_FILES = 10;

let selectedMediaFiles = [];
let mediaViewerIndex = 0;

const sectionSubsections = {
  studio: [
    ['general', 'أعمال الاستوديو']
  ],
  poetry: [
    ['poems', 'قصائد شعرية']
  ],
  theatre: [
    ['plays', 'مسرحيات']
  ],
  events: [
    ['general', 'فعاليات ومناسبات']
  ],
  festivals: [
    ['general', 'مهرجانات']
  ],
  articles: [
    ['general', 'مقالات']
  ]
};

function updateSubsections() {
  const sections = sectionSubsections[postSection.value] || [];

  postSubsection.innerHTML = '<option value="">اختر القسم الفرعي</option>';

  sections.forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    postSubsection.appendChild(option);
  });
}

function closeMediaViewer() {
  mediaViewer.classList.remove('open');
  mediaViewer.setAttribute('aria-hidden', 'true');
  mediaViewerStage.innerHTML = '';
  document.body.style.overflow = '';
}

function renderMediaViewer() {
  if (!selectedMediaFiles.length) {
    return;
  }

  const file = selectedMediaFiles[mediaViewerIndex];

  if (!file) {
    return;
  }

  mediaViewerStage.innerHTML = '';

  const fileUrl = URL.createObjectURL(file);

  if (file.type.startsWith('image/')) {
    const image = document.createElement('img');
    image.src = fileUrl;
    image.alt = 'عرض الصورة';
    mediaViewerStage.appendChild(image);
  } else if (file.type.startsWith('video/')) {
    const video = document.createElement('video');
    video.src = fileUrl;
    video.controls = true;
    video.autoplay = true;
    video.preload = 'metadata';
    mediaViewerStage.appendChild(video);
  }

  mediaViewer.classList.add('open');
  mediaViewer.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function showPreviousMedia() {
  if (selectedMediaFiles.length <= 1) {
    return;
  }

  mediaViewerIndex =
    (mediaViewerIndex - 1 + selectedMediaFiles.length) %
    selectedMediaFiles.length;

  renderMediaViewer();
}

function showNextMedia() {
  if (selectedMediaFiles.length <= 1) {
    return;
  }

  mediaViewerIndex =
    (mediaViewerIndex + 1) %
    selectedMediaFiles.length;

  renderMediaViewer();
}

function showSelectedFiles(input) {
  selectedMediaFiles = Array.from(input.files);

  if (!selectedMediaFiles.length) {
    postSelectedFile.innerHTML = '';
    postSelectedFile.dataset.count = '0';
    return;
  }

  if (selectedMediaFiles.length > MAX_MEDIA_FILES) {
    alert(`الحد الأقصى المسموح به هو ${MAX_MEDIA_FILES} ملفات فقط.`);
    input.value = '';
    selectedMediaFiles = [];
    postSelectedFile.innerHTML = '';
    postSelectedFile.dataset.count = '0';
    return;
  }

  postSelectedFile.innerHTML = '';
  postSelectedFile.dataset.count = selectedMediaFiles.length;

  const visibleCount = selectedMediaFiles.length > 5
    ? 5
    : selectedMediaFiles.length;

  const visibleFiles = selectedMediaFiles.slice(0, visibleCount);
  const extraCount = selectedMediaFiles.length - visibleCount;

  visibleFiles.forEach((file, index) => {
    const fileUrl = URL.createObjectURL(file);

    const mediaItem = document.createElement('div');
    mediaItem.className = 'post-media-item';

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'post-media-remove';
    removeButton.setAttribute('aria-label', 'حذف الوسائط');
    removeButton.innerHTML =
      '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';

    removeButton.addEventListener('click', (event) => {
      event.stopPropagation();

      URL.revokeObjectURL(fileUrl);

      selectedMediaFiles = selectedMediaFiles.filter(
        (_, fileIndex) => fileIndex !== index
      );

      const dataTransfer = new DataTransfer();

      selectedMediaFiles.forEach((selectedFile) => {
        dataTransfer.items.add(selectedFile);
      });

      postMedia.files = dataTransfer.files;

      showSelectedFiles(postMedia);
    });

    mediaItem.appendChild(removeButton);

    mediaItem.style.cursor = 'pointer';

    mediaItem.addEventListener('click', () => {
      mediaViewerIndex = index;
      renderMediaViewer();
    });

    if (file.type.startsWith('image/')) {
      const preview = document.createElement('img');
      preview.src = fileUrl;
      preview.alt = `معاينة الصورة ${index + 1}`;
      preview.className = 'post-media-preview';
      mediaItem.appendChild(preview);
    } else if (file.type.startsWith('video/')) {
      const preview = document.createElement('video');
      preview.src = fileUrl;
      preview.className = 'post-media-preview';
      preview.controls = true;
      preview.preload = 'metadata';
      mediaItem.appendChild(preview);
    }

    if (index === visibleFiles.length - 1 && extraCount > 0) {
      const overlay = document.createElement('div');
      overlay.className = 'post-media-more';
      overlay.textContent = `+${extraCount}`;
      mediaItem.appendChild(overlay);
    }

    postSelectedFile.appendChild(mediaItem);
  });
}

postSection.addEventListener('change', updateSubsections);
postMedia.addEventListener('change', () => {
  showSelectedFiles(postMedia);
});

mediaViewerBack.addEventListener('click', closeMediaViewer);
mediaViewerOverlay.addEventListener('click', closeMediaViewer);
mediaViewerPrev.addEventListener('click', showPreviousMedia);
mediaViewerNext.addEventListener('click', showNextMedia);

document.addEventListener('keydown', (event) => {
  if (!mediaViewer.classList.contains('open')) {
    return;
  }

  if (event.key === 'Escape') {
    closeMediaViewer();
  }

  if (event.key === 'ArrowRight') {
    showPreviousMedia();
  }

  if (event.key === 'ArrowLeft') {
    showNextMedia();
  }
});

publishPostButton.addEventListener('click', async () => {
  const title = postTitle.value.trim();
  const section = postSection.value.trim();
  const subsection = postSubsection.value.trim();
  const content = postContent.value.trim();

  if (!title) {
    alert('يرجى كتابة عنوان المنشور');
    postTitle.focus();
    return;
  }

  if (!section) {
    alert('يرجى اختيار القسم');
    postSection.focus();
    return;
  }

  publishPostButton.disabled = true;

  const originalText = publishPostButton.innerHTML;

  publishPostButton.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i><span>جاري النشر...</span>';

  try {
    const response = await fetch('/api/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        title,
        section,
        subsection,
        content
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'تعذر نشر المنشور');
    }

    alert('تم نشر المنشور بنجاح');

    postTitle.value = '';
    postContent.value = '';
    postSection.value = 'studio';

    updateSubsections();

    selectedMediaFiles = [];
    postMedia.value = '';
    postSelectedFile.innerHTML = '';
    postSelectedFile.dataset.count = '0';

  } catch (error) {
    console.error('Publish post error:', error);
    alert(error.message || 'حدث خطأ أثناء نشر المنشور');
  } finally {
    publishPostButton.disabled = false;
    publishPostButton.innerHTML = originalText;
  }
});

updateSubsections();
