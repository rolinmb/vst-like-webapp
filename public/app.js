async function init() {

    // --------------------------------------------------
    // DOM ELEMENTS
    // --------------------------------------------------

    const audioUpload = document.getElementById("audio-upload");

    const fileInfo = document.getElementById("file-info");

    const audioContainer = document.getElementById("audio-container");

    const audioFilename = document.getElementById("audio-filename");

    const audioPlayer = document.getElementById("audio-player");

    const appStatus = document.getElementById("app-status");

    const canvas = document.getElementById("spectrogram");

    const ctx = canvas.getContext("2d");


    // --------------------------------------------------
    // AUDIO VARIABLES
    // --------------------------------------------------

    let audioContext = null;

    let analyser = null;

    let source = null;

    let frequencyData = null;

    let animationFrame = null;


    // --------------------------------------------------
    // SPECTROGRAM SETTINGS
    // --------------------------------------------------

    const FFT_SIZE = 2048;

    const MIN_FREQUENCY = 20;

    const MAX_FREQUENCY = 20000;

    const MIN_DB = -100;

    const MAX_DB = -25;


    // --------------------------------------------------
    // CANVAS INITIALIZATION
    // --------------------------------------------------

    function resizeCanvas() {

        const rect = canvas.getBoundingClientRect();

        const dpr = window.devicePixelRatio || 1;

        canvas.width = Math.max(1, Math.floor(rect.width * dpr));

        canvas.height = Math.max(1, Math.floor(rect.height * dpr));

        clearSpectrogram();

    }


    function clearSpectrogram() {

        ctx.fillStyle = "#080808";

        ctx.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

    }


    // --------------------------------------------------
    // AUDIO CONTEXT INITIALIZATION
    // --------------------------------------------------

    function initializeAudioContext() {

        if (audioContext) {
            return;
        }

        audioContext = new AudioContext();

        analyser = audioContext.createAnalyser();

        analyser.fftSize = FFT_SIZE;

        analyser.smoothingTimeConstant = 0.65;

        analyser.minDecibels = MIN_DB;

        analyser.maxDecibels = MAX_DB;

        frequencyData = new Uint8Array(analyser.frequencyBinCount);

        // Connect audio element to Web Audio API

        source = audioContext.createMediaElementSource(audioPlayer);

        source.connect(analyser);

        // Connect analyser to speakers

        analyser.connect(audioContext.destination);

    }


    // --------------------------------------------------
    // FREQUENCY TO CANVAS POSITION
    // --------------------------------------------------

    function getFrequencyBin(y) {

        const normalizedY = y / canvas.height;

        // Logarithmic frequency scale

        const frequency = MAX_FREQUENCY *
            Math.pow(
                MIN_FREQUENCY / MAX_FREQUENCY,
                normalizedY
            );

        const nyquist = audioContext.sampleRate / 2;

        const bin = Math.round(
            frequency / nyquist * FFT_SIZE
        );

        return Math.max(
            0,
            Math.min(bin, frequencyData.length - 1)
        );

    }


    // --------------------------------------------------
    // FREQUENCY INTENSITY TO COLOR
    // --------------------------------------------------

    function getColor(intensity) {

        // intensity ranges from 0 to 1

        const hue = 270 - intensity * 270;

        const saturation = 100;

        const lightness = 8 + intensity * 52;

        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;

    }


    // --------------------------------------------------
    // DRAW SPECTROGRAM
    // --------------------------------------------------

    function drawSpectrogram() {

        if (!analyser || audioPlayer.paused) {
            return;
        }

        const width = canvas.width;

        const height = canvas.height;

        // Obtain frequency-domain data

        analyser.getByteFrequencyData(frequencyData);

        // Shift existing spectrogram one pixel left

        ctx.drawImage(
            canvas, -1,
            0
        );

        // Draw the newest frequency column

        const x = width - 1;

        for (let y = 0; y < height; y++) {

            const bin = getFrequencyBin(y);

            const magnitude = frequencyData[bin];

            // Normalize intensity

            const intensity = magnitude / 255;

            // Apply color gradient

            ctx.fillStyle = getColor(intensity);

            ctx.fillRect(
                x,
                y,
                1,
                1
            );

        }

        // Continue animation

        animationFrame = requestAnimationFrame(
            drawSpectrogram
        );

    }


    // --------------------------------------------------
    // START SPECTROGRAM
    // --------------------------------------------------

    async function startSpectrogram() {

        initializeAudioContext();

        if (audioContext.state === "suspended") {
            await audioContext.resume();
        }

        cancelAnimationFrame(animationFrame);

        drawSpectrogram();

    }


    // --------------------------------------------------
    // STOP SPECTROGRAM
    // --------------------------------------------------

    function stopSpectrogram() {

        cancelAnimationFrame(animationFrame);

        animationFrame = null;

    }


    // --------------------------------------------------
    // AUDIO PLAYBACK EVENTS
    // --------------------------------------------------

    audioPlayer.addEventListener("play", async() => {

        try {

            await startSpectrogram();

            appStatus.textContent = "";

        } catch (error) {

            appStatus.textContent = "Unable to initialize audio analysis.";

            console.error(error);

        }

    });


    audioPlayer.addEventListener("pause", () => {

        stopSpectrogram();

    });


    audioPlayer.addEventListener("ended", () => {

        stopSpectrogram();

    });


    // --------------------------------------------------
    // AUDIO FILE UPLOAD
    // --------------------------------------------------

    audioUpload.addEventListener("change", (event) => {

        const file = event.target.files[0];

        if (!file) {
            return;
        }

        // Validate extension

        const extension = file.name
            .split(".")
            .pop()
            .toLowerCase();

        if (extension !== "mp3" && extension !== "wav") {

            appStatus.textContent =
                "Invalid file format. Please upload an MP3 or WAV file.";

            audioUpload.value = "";

            return;
        }

        // Validate MIME type when provided

        const validTypes = [
            "audio/mpeg",
            "audio/mp3",
            "audio/wav",
            "audio/x-wav",
            "audio/wave",
            "audio/vnd.wave",
            "audio/x-pn-wav",
            ""
        ];

        if (!validTypes.includes(file.type)) {

            appStatus.textContent = "Invalid audio MIME type.";

            audioUpload.value = "";

            return;
        }

        // Stop previous playback and animation

        audioPlayer.pause();

        stopSpectrogram();

        // Release previous object URL

        if (audioPlayer.dataset.objectUrl) {

            URL.revokeObjectURL(
                audioPlayer.dataset.objectUrl
            );

        }

        // Clear previous spectrogram

        clearSpectrogram();

        // Create new audio URL

        const audioURL = URL.createObjectURL(file);

        audioPlayer.dataset.objectUrl = audioURL;

        audioPlayer.src = audioURL;

        audioPlayer.load();

        // Update interface

        audioFilename.textContent = file.name;

        fileInfo.textContent = file.name;

        audioContainer.hidden = false;

        appStatus.textContent = "";

    });


    // --------------------------------------------------
    // WINDOW EVENTS
    // --------------------------------------------------

    window.addEventListener("resize", () => {

        resizeCanvas();

    });


    // --------------------------------------------------
    // INITIALIZATION
    // --------------------------------------------------

    resizeCanvas();

    clearSpectrogram();

}

init();