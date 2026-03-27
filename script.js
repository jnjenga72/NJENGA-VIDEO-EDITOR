const videoInput = document.getElementById('videoInput');
const audioInput = document.getElementById('audioInput');
const mainVideo = document.getElementById('mainVideo');
const overlayText = document.getElementById('overlayText');
const textPreview = document.getElementById('textPreview');
const exportBtn = document.getElementById('exportBtn');
const playBtn = document.getElementById('playBtn');
const razorBtn = document.getElementById('razorBtn');
const deleteBtn = document.getElementById('deleteBtn');
const duplicateBtn = document.getElementById('duplicateBtn');
const colorGrade = document.getElementById('colorGrade');
const addKeyframe = document.getElementById('addKeyframe');
const addTextOverlayAtPlayhead = document.getElementById('addTextOverlayAtPlayhead');
const timestampDisplay = document.getElementById('timestamp'); // Reference to the timestamp display
const playhead = document.getElementById('playhead'); // Reference to the playhead element
const videoTimelineTrack = document.getElementById('videoTimelineTrack'); // Reference to the timeline track container
const videoSpeedInput = document.getElementById('videoSpeed');
const videoSpeedDisplay = document.getElementById('videoSpeedDisplay');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoomLevelDisplay = document.getElementById('zoomLevelDisplay');
const timelineRuler = document.getElementById('timelineRuler');
const rulerMarks = document.getElementById('rulerMarks');
const audioWaveform = document.getElementById('audioWaveform');
const textOverlayTrack = document.getElementById('textOverlayTrack');
const videoDropZone = document.getElementById('videoDropZone');
const canvasOrientation = document.getElementById('canvasOrientation');
const previewContainer = document.getElementById('previewContainer');
const propertiesPanel = document.getElementById('propertiesPanel');
const addShapeBtn = document.getElementById('addShapeBtn');

let videoFile = null;
let audioFile = null;
let clips = []; // Track split segments [{id, start, end, originalStart, originalEnd, speed, textOverlays: []}]
let keyframes = []; // [{time, opacity}]
let textOverlays = []; // [{id, text, startTime, duration, keyframes: []}]
let shapes = []; // [{id, type, x, y, scale, rotation, color, opacity}]
let videoDuration = 0; // Stores the total duration of the loaded video
let isDraggingPlayhead = false; // State to track if the playhead is being dragged
let zoomLevel = 1; // 1 = 100% zoom
let trimmingData = null; // Stores { clip, side } when trimming
let selectedElement = null; // Currently selected text or shape
let isDraggingElement = false;

// Hide download if running as installed App
if (window.matchMedia('(display-mode: standalone)').matches) {
    exportBtn.style.display = 'none';
}

// Register Service Worker for Offline Access
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
}

// Video Upload & Preview
function processVideoFile(file) {
    if (!file || !file.type.startsWith('video/')) return;
    videoFile = file;
    const url = URL.createObjectURL(videoFile);
    mainVideo.src = url;
    document.getElementById('previewContainer').classList.remove('hidden');
    document.getElementById('emptyState').classList.add('hidden');
}

videoInput.addEventListener('change', (e) => processVideoFile(e.target.files[0]));

// Drag and Drop for Video
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    videoDropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
    }, false);
});

videoDropZone.addEventListener('dragover', () => videoDropZone.classList.add('border-blue-500', 'bg-zinc-800/50'));
videoDropZone.addEventListener('dragleave', () => videoDropZone.classList.remove('border-blue-500', 'bg-zinc-800/50'));
videoDropZone.addEventListener('drop', (e) => {
    videoDropZone.classList.remove('border-blue-500', 'bg-zinc-800/50');
    processVideoFile(e.dataTransfer.files[0]);
});

// Handle Orientation Change
canvasOrientation.addEventListener('change', (e) => {
    mainVideo.className = e.target.value === 'portrait' ? 'preview-portrait rounded-lg' : 'preview-landscape rounded-lg';
    renderTimeline();
});

// When video metadata is loaded, get duration and set initial clips
mainVideo.addEventListener('loadedmetadata', () => {
    videoDuration = mainVideo.duration;
    clips = [{ id: Date.now(), originalFile: videoFile, start: 0, end: videoDuration, originalStart: 0, originalEnd: videoDuration, speed: 1, textOverlays: [] }]; // Initialize clips with the full video
    timestampDisplay.innerText = `${formatTime(mainVideo.currentTime)} / ${formatTime(videoDuration)}`;
    renderTimeline();
    updateRuler();
});

// Video Speed Adjustment
videoSpeedInput.addEventListener('input', (e) => {
    const speed = parseFloat(e.target.value);
    mainVideo.playbackRate = speed;
    videoSpeedDisplay.innerText = `${Math.round(speed * 100)}%`;
    
    // Update the speed for all clips (or you could target the active clip)
    clips = clips.map(clip => ({ ...clip, speed: speed }));
});

// Color Grading Preview
colorGrade.addEventListener('change', (e) => {
    const filters = {
        none: '',
        film: 'contrast(1.2) saturate(1.1) sepia(0.2)',
        noir: 'grayscale(1) contrast(1.5)',
        warm: 'sepia(0.5) brightness(1.1)',
        cold: 'hue-rotate(180deg) saturate(0.8)'
    };
    mainVideo.style.filter = filters[e.target.value];
});

// Razor Tool (Split) logic - now actually splits clips
razorBtn.addEventListener('click', () => {
    if (!videoFile || clips.length === 0) return;
    const currentTime = mainVideo.currentTime;
    let newClips = [];
    let splitPerformed = false;

    clips.forEach(clip => {
        if (currentTime > clip.start && currentTime < clip.end) {
            // Split this clip
            newClips.push({ ...clip, id: Date.now() + Math.random(), end: currentTime });
            newClips.push({ ...clip, id: Date.now() + Math.random() + 1, start: currentTime });
            splitPerformed = true;
        } else {
            newClips.push(clip);
        }
    });

    if (splitPerformed) {
        clips = newClips.sort((a, b) => a.start - b.start);
        renderTimeline();
    }
    razorBtn.classList.add('bg-red-600', 'text-white');
    setTimeout(() => razorBtn.classList.remove('bg-red-600', 'text-white'), 200);
});

// Keyframe Logic
addKeyframe.addEventListener('click', () => {
    keyframes.push({ time: mainVideo.currentTime, opacity: 1.0 });
    alert(`Keyframe added at ${mainVideo.currentTime.toFixed(2)}s`);
});

// Add Text Overlay at Playhead
addTextOverlayAtPlayhead.addEventListener('click', () => {
    if (!videoFile) return alert('Please upload a video first.');
    const id = Date.now();
    textOverlays.push({ 
        id, 
        text: "NEW TEXT", 
        startTime: mainVideo.currentTime, 
        duration: 5, 
        scale: 100, 
        rotation: 0, 
        color: '#ffffff', 
        opacity: 100,
        font: 'Inter',
        keyframes: { scale: [], rotation: [] }
    });
    renderTimeline();
});

addShapeBtn.addEventListener('click', () => {
    shapes.push({
        id: Date.now(),
        startTime: mainVideo.currentTime,
        duration: 5,
        scale: 100,
        rotation: 0,
        color: '#3b82f6',
        opacity: 80,
        keyframes: { scale: [], rotation: [] },
        x: 50,
        y: 50
    });
    renderTimeline();
});

// Delete Selected Element
deleteBtn.addEventListener('click', () => {
    if (!selectedElement) return;
    const id = selectedElement.data.id;

    if (selectedElement.type === 'clip') {
        clips = clips.filter(c => c.id !== id);
    } else if (selectedElement.type === 'text') {
        textOverlays = textOverlays.filter(t => t.id !== id);
    } else if (selectedElement.type === 'shape') {
        shapes = shapes.filter(s => s.id !== id);
    }

    selectedElement = null;
    propertiesPanel.classList.add('hidden');
    renderTimeline();
    renderCanvasElements();
});

// Duplicate Selected Element
duplicateBtn.addEventListener('click', () => {
    if (!selectedElement) return;
    const original = selectedElement.data;
    const type = selectedElement.type;
    const newId = Date.now() + Math.random();

    if (type === 'clip') {
        const copy = { ...original, id: newId };
        clips.push(copy);
        clips.sort((a, b) => a.start - b.start);
    } else if (type === 'text') {
        const copy = JSON.parse(JSON.stringify(original));
        copy.id = newId;
        // Offset position slightly to make the copy visible
        copy.x = (copy.x || 50) + 2;
        copy.y = (copy.y || 50) + 2;
        textOverlays.push(copy);
    } else if (type === 'shape') {
        const copy = JSON.parse(JSON.stringify(original));
        copy.id = newId;
        copy.x = (copy.x || 50) + 2;
        copy.y = (copy.y || 50) + 2;
        shapes.push(copy);
    }

    renderTimeline();
    renderCanvasElements();
});

// Audio Selection
function processAudioFile(file) {
    if (!file || !file.type.startsWith('audio/')) return;
    audioFile = file;
    const audioTrack = document.getElementById('audioTrack');
    audioTrack.innerHTML = `<div class="absolute top-1 bottom-1 left-0 right-0 bg-emerald-600/40 border border-emerald-500 rounded flex items-center px-3 text-[10px] text-emerald-200">${audioFile.name}</div>`;
}

audioInput.addEventListener('change', (e) => processAudioFile(e.target.files[0]));

// Enable drop for audio directly on input
audioInput.addEventListener('dragover', () => audioInput.classList.add('border-emerald-500'));
audioInput.addEventListener('dragleave', () => audioInput.classList.remove('border-emerald-500'));
audioInput.addEventListener('drop', (e) => {
    audioInput.classList.remove('border-emerald-500');
    processAudioFile(e.dataTransfer.files[0]);
});

// Properties Editor Logic
function openProperties(element, type) {
    selectedElement = { data: element, type: type };
    propertiesPanel.classList.remove('hidden');
    document.getElementById('propScale').value = element.scale || 100;
    document.getElementById('propRotate').value = element.rotation || 0;
    document.getElementById('propOpacity').value = element.opacity || 100;
    document.getElementById('propColor').value = element.color || '#ffffff';
    
    if (type === 'text') {
        overlayText.value = element.text;
    }
}

function getInterpolatedValue(propKeyframes, currentTime, defaultValue) {
    if (!propKeyframes || propKeyframes.length === 0) return defaultValue;
    if (currentTime <= propKeyframes[0].time) return propKeyframes[0].value;
    if (currentTime >= propKeyframes[propKeyframes.length - 1].time) return propKeyframes[propKeyframes.length - 1].value;

    for (let i = 0; i < propKeyframes.length - 1; i++) {
        const start = propKeyframes[i];
        const end = propKeyframes[i + 1];
        if (currentTime >= start.time && currentTime <= end.time) {
            const t = (currentTime - start.time) / (end.time - start.time);
            return start.value + (end.value - start.value) * t;
        }
    }
    return defaultValue;
}

function addElementKeyframe(prop) {
    if (!selectedElement) return;
    const el = selectedElement.data;
    if (!el.keyframes) el.keyframes = { scale: [], rotation: [] };
    if (!el.keyframes[prop]) el.keyframes[prop] = [];

    const time = mainVideo.currentTime;
    const value = el[prop];

    el.keyframes[prop] = el.keyframes[prop].filter(k => k.time !== time);
    el.keyframes[prop].push({ time, value });
    el.keyframes[prop].sort((a, b) => a.time - b.time);
    
    alert(`${prop.charAt(0).toUpperCase() + prop.slice(1)} keyframe added at ${time.toFixed(2)}s`);
}

['propScale', 'propRotate', 'propOpacity', 'propColor', 'propFont'].forEach(id => {
    document.getElementById(id).addEventListener('input', (e) => {
        if (!selectedElement) return;
        const val = e.target.value;
        const key = id.replace('prop', '').toLowerCase();
        selectedElement.data[key] = id === 'propColor' || id === 'propFont' ? val : parseFloat(val);
        applyPreviewStyles();
    });
});

['Scale', 'Rotate'].forEach(prop => {
    document.getElementById(`key${prop}`).addEventListener('click', () => {
        addElementKeyframe(prop.toLowerCase());
    });
});

function applyPreviewStyles() {
    if (!selectedElement) return;
    const el = selectedElement.data;
    const domEl = document.getElementById(`preview-${el.id}`);
    if (!domEl) return;

    const scale = getInterpolatedValue(el.keyframes?.scale, mainVideo.currentTime, el.scale || 100);
    const rotation = getInterpolatedValue(el.keyframes?.rotation, mainVideo.currentTime, el.rotation || 0);

    domEl.style.transform = `translate(-50%, -50%) scale(${scale / 100}) rotate(${rotation}deg)`;
    domEl.style.opacity = el.opacity / 100;
    
    if (selectedElement.type === 'text') {
        domEl.style.color = el.color;
        domEl.style.fontFamily = el.font;
        domEl.innerText = el.text;
    } else {
        domEl.style.backgroundColor = el.color;
    }
}

// Canvas Element Dragging
document.getElementById('canvasOverlay').addEventListener('mousedown', (e) => {
    if (e.target.dataset.id) {
        const id = parseFloat(e.target.dataset.id);
        const foundText = textOverlays.find(t => t.id === id);
        const foundShape = shapes.find(s => s.id === id);
        
        if (foundText) openProperties(foundText, 'text');
        if (foundShape) openProperties(foundShape, 'shape');
        
        isDraggingElement = true;
    }
});

document.addEventListener('mousemove', (e) => {
    if (isDraggingElement && selectedElement) {
        const canvas = document.getElementById('canvasOverlay');
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        
        selectedElement.data.x = x;
        selectedElement.data.y = y;
        
        const domEl = document.getElementById(`preview-${selectedElement.data.id}`);
        if (domEl) {
            domEl.style.left = `${x}%`;
            domEl.style.top = `${y}%`;
        }
    }
});

document.addEventListener('mouseup', () => {
    isDraggingElement = false;
});

// Image to Cartoon Filter Logic
document.getElementById('imageToCartoonInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        mainVideo.src = url; // Use video preview area for simplicity
        mainVideo.style.filter = 'url(#cartoon-filter) contrast(1.5) saturate(1.2)';
        document.getElementById('previewContainer').classList.remove('hidden');
        document.getElementById('emptyState').classList.add('hidden');
    }
});

// Subtitle Sync
overlayText.addEventListener('input', (e) => {
    if (selectedElement && selectedElement.type === 'text') {
        selectedElement.data.text = e.target.value;
        applyPreviewStyles();
    }
});

// Playback Logic
playBtn.addEventListener('click', togglePlayPause);

function togglePlayPause() {
    if (!videoFile) return;

    if (mainVideo.paused || mainVideo.ended) {
        mainVideo.play();
        playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    } else {
        mainVideo.pause();
        playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    }
}

// Helper function to format time (MM:SS)
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes < 10 ? '0' : ''}${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

// Update playhead position and timestamp during playback
mainVideo.addEventListener('timeupdate', () => {
    if (!isDraggingPlayhead && videoDuration > 0) {
        updatePlayheadPosition();
    }
    renderCanvasElements();
});

function renderCanvasElements() {
    const overlay = document.getElementById('canvasOverlay');
    // We need to keep elements that are active but also update their DOM
    const currentTime = mainVideo.currentTime;
    
    const activeItems = [
        ...textOverlays.filter(t => currentTime >= t.startTime && currentTime <= (t.startTime + t.duration)).map(t => ({...t, type: 'text'})),
        ...shapes.filter(s => currentTime >= s.startTime && currentTime <= (s.startTime + s.duration)).map(s => ({...s, type: 'shape'}))
    ];

    overlay.innerHTML = ''; // Re-render for simplicity in this version
    activeItems.forEach(item => {
        const scale = getInterpolatedValue(item.keyframes?.scale, currentTime, item.scale || 100);
        const rotation = getInterpolatedValue(item.keyframes?.rotation, currentTime, item.rotation || 0);

        const el = document.createElement('div');
        el.id = `preview-${item.id}`;
        el.dataset.id = item.id;
        el.style.position = 'absolute';
        el.style.left = `${item.x || 50}%`;
        el.style.top = `${item.y || 50}%`;
        el.style.transform = `translate(-50%, -50%) scale(${scale / 100}) rotate(${rotation}deg)`;
        el.style.opacity = (item.opacity || 100) / 100;
        el.style.pointerEvents = 'auto';
        el.style.cursor = 'move';
        el.style.color = item.color;
        if (item.type === 'text') el.innerText = item.text;
        else { el.style.width = '100px'; el.style.height = '100px'; el.style.backgroundColor = item.color; }
        overlay.appendChild(el);
    });
}

function updatePlayheadPosition() {
    const progress = (mainVideo.currentTime / videoDuration) * 100;
    playhead.style.left = `${progress}%`; // Move playhead
    timestampDisplay.innerText = `${formatTime(mainVideo.currentTime)} / ${formatTime(videoDuration)}`; // Update timestamp
}

// Playhead Dragging (Scrubbing)
playhead.addEventListener('mousedown', (e) => {
    if (!videoFile) return;
    e.preventDefault(); // Prevent default browser drag behavior
    isDraggingPlayhead = true;
    mainVideo.pause(); // Pause video when dragging starts
    playBtn.innerHTML = '<i class="fa-solid fa-play"></i>'; // Update play button icon
});

// Add global mouseup listener to stop dragging even if mouse leaves the track
document.addEventListener('mouseup', () => {
    trimmingData = null;
    isDraggingPlayhead = false;
    document.body.style.cursor = 'default';
});

document.addEventListener('mousemove', (e) => {
    handlePlayheadMove(e);
    handleTrimmingMove(e);
});

function handlePlayheadMove(e) {
    if (isDraggingPlayhead && videoDuration > 0) {
        const trackRect = videoTimelineTrack.getBoundingClientRect();
        let newX = e.clientX - trackRect.left;
        newX = Math.max(0, Math.min(newX, trackRect.width)); // Clamp position within track bounds
        
        const progress = newX / trackRect.width;
        mainVideo.currentTime = progress * videoDuration;
        playhead.style.left = `${progress * 100}%`;
        timestampDisplay.innerText = `${formatTime(mainVideo.currentTime)} / ${formatTime(videoDuration)}`;
    }
}

function handleTrimmingMove(e) {
    if (!trimmingData || videoDuration <= 0) return;

    const trackRect = videoTimelineTrack.getBoundingClientRect();
    let mouseX = e.clientX - trackRect.left;
    let timeAtMouse = (mouseX / trackRect.width) * videoDuration;
    
    const { clip, side } = trimmingData;

    if (side === 'left') {
        // Ensure start doesn't exceed end and stays within bounds
        const newStart = Math.max(0, Math.min(timeAtMouse, clip.end - 0.5));
        clip.start = newStart;
        mainVideo.currentTime = newStart; // Preview the new start point
    } else if (side === 'right') {
        // Ensure end doesn't go below start and stays within bounds
        const newEnd = Math.min(videoDuration, Math.max(timeAtMouse, clip.start + 0.5));
        clip.end = newEnd;
        mainVideo.currentTime = newEnd; 
    }
    renderTimeline();
}

// Allow clicking on the timeline track to jump playhead
videoTimelineTrack.addEventListener('click', (e) => {
    if (!isDraggingPlayhead && videoDuration > 0) { // Only jump if not currently dragging
        const trackRect = videoTimelineTrack.getBoundingClientRect();
        const clickX = e.clientX - trackRect.left;
        const progress = clickX / trackRect.width;
        mainVideo.currentTime = progress * videoDuration;
        
        selectedElement = null;
        propertiesPanel.classList.add('hidden');
        playhead.style.left = `${progress * 100}%`;
        timestampDisplay.innerText = `${formatTime(mainVideo.currentTime)} / ${formatTime(videoDuration)}`;
    }
});

// Render Timeline Clips and Overlays
function renderTimeline() {
    videoTimelineTrack.innerHTML = ''; // Clear existing clips
    textOverlayTrack.innerHTML = ''; // Clear existing text overlays

    const totalTimelineWidth = videoTimelineTrack.offsetWidth;

    // Render Video Clips
    clips.forEach(clip => {
        const clipWidth = ((clip.end - clip.start) / videoDuration) * totalTimelineWidth;
        const clipLeft = (clip.start / videoDuration) * totalTimelineWidth;

        const clipDiv = document.createElement('div');
        clipDiv.className = 'absolute top-1 bottom-1 bg-blue-600/40 border border-blue-500 rounded flex items-center px-3 text-[10px] text-blue-200 truncate';
        clipDiv.style.left = `${clipLeft}px`;
        clipDiv.style.width = `${clipWidth}px`;
        clipDiv.innerText = clip.originalFile.name; // Display original file name

        // Highlight if selected
        if (selectedElement?.type === 'clip' && selectedElement.data.id === clip.id) {
            clipDiv.classList.add('ring-2', 'ring-yellow-500', 'border-yellow-500');
        }

        // Clip Selection
        clipDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            selectedElement = { data: clip, type: 'clip' };
            propertiesPanel.classList.add('hidden');
            renderTimeline();
        });

        // Add Trim Handles
        const leftHandle = document.createElement('div');
        leftHandle.className = 'absolute left-0 top-0 bottom-0 w-2 bg-blue-400 cursor-ew-resize hover:bg-white z-10';
        leftHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            trimmingData = { clip, side: 'left' };
            document.body.style.cursor = 'ew-resize';
        });

        const rightHandle = document.createElement('div');
        rightHandle.className = 'absolute right-0 top-0 bottom-0 w-2 bg-blue-400 cursor-ew-resize hover:bg-white z-10';
        rightHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            trimmingData = { clip, side: 'right' };
            document.body.style.cursor = 'ew-resize';
        });

        clipDiv.appendChild(leftHandle);
        clipDiv.appendChild(rightHandle);
        videoTimelineTrack.appendChild(clipDiv);
    });

    // Re-add playhead after clips
    videoTimelineTrack.appendChild(playhead);

    // Render Text Overlays
    // This is a simplified visual representation. Actual positioning needs more work for complex layouts.
    textOverlays.forEach(overlay => {
        const overlayDiv = document.createElement('div');
        overlayDiv.className = 'absolute h-8 bg-purple-600/40 border border-purple-500 rounded flex items-center px-2 text-[8px] text-purple-200 truncate';
        const overlayWidth = ((overlay.duration) / videoDuration) * totalTimelineWidth;
        const overlayLeft = (overlay.startTime / videoDuration) * totalTimelineWidth;
        overlayDiv.style.left = `${overlayLeft}px`;
        overlayDiv.style.width = `${overlayWidth}px`;
        overlayDiv.style.top = '50%'; // Center vertically for now
        overlayDiv.style.transform = 'translateY(-50%)';
        overlayDiv.innerText = overlay.text;
        textOverlayTrack.appendChild(overlayDiv);
    });

    updatePlayheadPosition(); // Ensure playhead is correctly positioned after re-render
}

// Timeline Zoom
zoomInBtn.addEventListener('click', () => {
    if (zoomLevel < 4) { // Max 4x zoom
        zoomLevel += 0.5;
        updateTimelineZoom();
    }
});

zoomOutBtn.addEventListener('click', () => {
    if (zoomLevel > 0.5) { // Min 0.5x zoom
        zoomLevel -= 0.5;
        updateTimelineZoom();
    }
});

function updateTimelineZoom() {
    zoomLevelDisplay.innerText = `${zoomLevel}x`;
    const newWidth = (videoTimelineTrack.parentElement.offsetWidth * zoomLevel); // Adjust parent width for zoom
    videoTimelineTrack.style.width = `${newWidth}px`;
    document.getElementById('audioTrack').style.width = `${newWidth}px`;
    renderTimeline();
    updateRuler();
}

// Timeline Ruler
function updateRuler() {
    rulerMarks.innerHTML = '';
    const totalWidth = videoTimelineTrack.offsetWidth;
    const secondsPerPixel = videoDuration / totalWidth;
    const markInterval = 5; // Mark every 5 seconds

    for (let i = 0; i < videoDuration; i += markInterval) {
        const leftPos = (i / videoDuration) * totalWidth;
        const mark = document.createElement('div');
        mark.className = 'absolute h-full border-l border-zinc-700';
        mark.style.left = `${leftPos}px`;
        mark.innerText = formatTime(i);
        rulerMarks.appendChild(mark);
    }
}

// Audio Waveform (Placeholder)
function drawAudioWaveform() {
    // This is a complex feature requiring Web Audio API to decode audio
    // and then drawing on a Canvas element.
    // For now, it's a visual placeholder.
    audioWaveform.style.background = 'linear-gradient(to right, #22c55e 0%, #22c55e 20%, #16a34a 50%, #22c55e 80%, #22c55e 100%)';
    audioWaveform.style.height = '100%';
    audioWaveform.style.width = '100%';
    audioWaveform.style.position = 'absolute';
    audioWaveform.style.top = '0';
    audioWaveform.style.left = '0';
}

// Initial call for waveform (will be a placeholder)
drawAudioWaveform();

// Initial render when page loads (empty state)
renderTimeline();

// Export Execution (updated to send more data)
exportBtn.addEventListener('click', async () => {
    if (!videoFile) return alert('Please upload a video first');

    exportBtn.disabled = true;
    exportBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

    const formData = new FormData();
    formData.append('video', videoFile); // Original video file
    if (audioFile) formData.append('audio', audioFile);
    formData.append('clips', JSON.stringify(clips)); // Send all clip data
    formData.append('textOverlays', JSON.stringify(textOverlays)); // Send all text overlays
    formData.append('grade', colorGrade.value);
    formData.append('quality', document.getElementById('videoQuality').value);
    formData.append('speed', mainVideo.playbackRate); // Send current playback speed
    // formData.append('videoTransitions', document.getElementById('videoTransition').value); // Send transition type
    // formData.append('audioEffects', '...'); // Placeholder for audio effects

    try {
        const response = await fetch('http://localhost:5000/api/export', { method: 'POST', body: formData });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }
        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl; a.download = 'edited_video.mp4'; a.click();
    } catch (err) {
        console.error('Export error:', err);
        alert('Error processing video: ' + err.message);
    } finally {
        exportBtn.disabled = false;
        exportBtn.innerHTML = '<i class="fa-solid fa-download"></i> Export Video';
    }
});