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

    // EFFECT CONTROLS

    const gainControl = document.getElementById("gain-control");

    const gainValue = document.getElementById("gain-value");

    const distortionType = document.getElementById("distortion-type");

    const driveControl = document.getElementById("drive-control");

    const driveValue = document.getElementById("drive-value");

    const mixControl = document.getElementById("mix-control");

    const mixValue = document.getElementById("mix-value");

    const bypassControl = document.getElementById("bypass-control");


    // --------------------------------------------------
    // AUDIO VARIABLES
    // --------------------------------------------------

    let audioContext = null;

    let source = null;

    let analyser = null;

    let inputGain = null;

    let waveshaper = null;

    let dryGain = null;

    let wetGain = null;

    let masterGain = null;

    let frequencyData = null;

    let animationFrame = null;

    let currentObjectURL = null;


    // --------------------------------------------------
    // SPECTROGRAM SETTINGS
    // --------------------------------------------------

    const FFT_SIZE = 2048;

    const MIN_FREQUENCY = 20;

    const MAX_FREQUENCY = 20000;

    const MIN_DB = -100;

    const MAX_DB = -25;


    // --------------------------------------------------
    // CANVAS
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

        ctx.fillRect(0, 0, canvas.width, canvas.height);

    }


    // --------------------------------------------------
    // DISTORTION ALGORITHMS
    // --------------------------------------------------

    function generateDistortionCurve(type, amount) {

        const samples = 4096;

        const curve = new Float32Array(samples);

        const drive = amount;

        for (let i = 0; i < samples; i++) {

            // Input range: -1 to 1

            const x = (i * 2) / samples - 1;

            const input = x * drive;

            let output = input;

            switch (type) {

                // --------------------------------------
                // HARD CLIPPING
                // --------------------------------------

                case "hard":

                    output = Math.max(-1,
                        Math.min(1, input)
                    );

                    break;


                    // --------------------------------------
                    // SOFT CLIPPING
                    // --------------------------------------

                case "soft":

                    output = input / (1 + Math.abs(input));

                    break;


                    // --------------------------------------
                    // HYPERBOLIC TANGENT
                    // --------------------------------------

                case "tanh":

                    output = Math.tanh(input);

                    break;


                    // --------------------------------------
                    // ARCTANGENT
                    // --------------------------------------

                case "atan":

                    output = (2 / Math.PI) * Math.atan(input);

                    break;


                    // --------------------------------------
                    // CUBIC DISTORTION
                    // --------------------------------------

                case "cubic":

                    output = input - Math.pow(input, 3) / 3;

                    output = Math.max(-1,
                        Math.min(1, output)
                    );

                    break;


                    // --------------------------------------
                    // SINE WAVE FOLDING
                    // --------------------------------------

                case "sine":

                    output = Math.sin(input * Math.PI / 2);

                    break;


                    // --------------------------------------
                    // FUZZ
                    // --------------------------------------

                case "fuzz":

                    output = Math.tanh(input * 2);

                    // Additional saturation

                    output = Math.sign(output) *
                        Math.pow(Math.abs(output), 0.5);

                    break;


                    // --------------------------------------
                    // ASYMMETRIC DISTORTION
                    // --------------------------------------

                case "asymmetric":
                    {

                        const bias = 0.4;

                        const positive = Math.tanh(
                            input + bias
                        );

                        const negative = Math.tanh(bias);

                        output = (positive - negative) /
                        (1 - negative);

                        break;

                    }


                    // --------------------------------------
                    // NO DISTORTION
                    // --------------------------------------

                case "none":

                    output = x;

                    break;

            }

            curve[i] = Math.max(-1,
                Math.min(1, output)
            );

        }

        return curve;

    }


    // --------------------------------------------------
    // UPDATE DISTORTION
    // --------------------------------------------------

    function updateDistortion() {

        if (!waveshaper) {
            return;
        }

        const type = distortionType.value;

        const drive = Number(driveControl.value);

        waveshaper.curve = generateDistortionCurve(
            type,
            drive
        );

        waveshaper.oversample = "4x";

        updateMix();

    }


    // --------------------------------------------------
    // UPDATE GAIN
    // --------------------------------------------------

    function updateGain() {

        const value = Number(gainControl.value);

        gainValue.textContent = value.toFixed(2) + "x";

        if (inputGain) {

            inputGain.gain.setTargetAtTime(
                value,
                audioContext.currentTime,
                0.01
            );

        }

    }


    // --------------------------------------------------
    // UPDATE WET / DRY MIX
    // --------------------------------------------------

    function updateMix() {

        const mix = Number(mixControl.value) / 100;

        mixValue.textContent =
            Math.round(mix * 100) + "%";

        if (!dryGain || !wetGain) {
            return;
        }

        const bypassed =
            bypassControl.checked ||
            distortionType.value === "none";

        const wet = bypassed ? 0 : mix;

        const dry = 1 - wet;

        dryGain.gain.setTargetAtTime(
            dry,
            audioContext.currentTime,
            0.01
        );

        wetGain.gain.setTargetAtTime(
            wet,
            audioContext.currentTime,
            0.01
        );

    }


    // --------------------------------------------------
    // AUDIO GRAPH INITIALIZATION
    // --------------------------------------------------

    function initializeAudioContext() {

        if (audioContext) {
            return;
        }

        audioContext = new AudioContext();

        // Create nodes

        source = audioContext.createMediaElementSource(
            audioPlayer
        );

        inputGain = audioContext.createGain();

        waveshaper = audioContext.createWaveShaper();

        dryGain = audioContext.createGain();

        wetGain = audioContext.createGain();

        masterGain = audioContext.createGain();

        analyser = audioContext.createAnalyser();


        // Configure analyser

        analyser.fftSize = FFT_SIZE;

        analyser.smoothingTimeConstant = 0.65;

        analyser.minDecibels = MIN_DB;

        analyser.maxDecibels = MAX_DB;

        frequencyData = new Uint8Array(
            analyser.frequencyBinCount
        );


        // Configure master output

        masterGain.gain.value = 0.8;


        // ----------------------------------------------
        // AUDIO ROUTING
        // ----------------------------------------------

        // Source -> Input Gain

        source.connect(inputGain);


        // Dry signal

        inputGain.connect(dryGain);


        // Wet signal

        inputGain.connect(waveshaper);

        waveshaper.connect(wetGain);


        // Combine dry and wet signals

        dryGain.connect(masterGain);

        wetGain.connect(masterGain);


        // Master -> Analyser -> Speakers

        masterGain.connect(analyser);

        analyser.connect(audioContext.destination);


        // Initialize controls

        updateGain();

        updateDistortion();

    }


    // --------------------------------------------------
    // SPECTROGRAM FREQUENCY MAPPING
    // --------------------------------------------------

    function getFrequencyBin(y) {

        const normalizedY = y / canvas.height;

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
    // SPECTROGRAM COLOR
    // --------------------------------------------------

    function getColor(intensity) {

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

        analyser.getByteFrequencyData(frequencyData);

        // Shift spectrogram left

        ctx.drawImage(
            canvas, -1,
            0
        );

        // Draw newest frequency column

        const x = width - 1;

        for (let y = 0; y < height; y++) {

            const bin = getFrequencyBin(y);

            const magnitude = frequencyData[bin];

            const intensity = magnitude / 255;

            ctx.fillStyle = getColor(intensity);

            ctx.fillRect(
                x,
                y,
                1,
                1
            );

        }

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

            appStatus.textContent =
                "Unable to initialize audio analysis.";

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
    // EFFECT CONTROL EVENTS
    // --------------------------------------------------

    gainControl.addEventListener("input", updateGain);


    driveControl.addEventListener("input", () => {

        driveValue.textContent =
            Number(driveControl.value).toFixed(1) + "x";

        updateDistortion();

    });


    distortionType.addEventListener("change", () => {

        updateDistortion();

    });


    mixControl.addEventListener("input", updateMix);


    bypassControl.addEventListener("change", updateMix);


    // --------------------------------------------------
    // AUDIO FILE UPLOAD
    // --------------------------------------------------

    audioUpload.addEventListener("change", (event) => {

        const file = event.target.files[0];

        if (!file) {
            return;
        }

        const extension = file.name
            .split(".")
            .pop()
            .toLowerCase();

        if (extension !== "mp3" && extension !== "wav") {

            appStatus.textContent =
                "Invalid file format. Please upload MP3 or WAV.";

            audioUpload.value = "";

            return;
        }

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

            appStatus.textContent =
                "Invalid audio MIME type.";

            audioUpload.value = "";

            return;
        }

        // Stop existing playback

        audioPlayer.pause();

        stopSpectrogram();

        // Release old object URL

        if (currentObjectURL) {

            URL.revokeObjectURL(currentObjectURL);

        }

        // Clear visualization

        clearSpectrogram();

        // Load new file

        currentObjectURL = URL.createObjectURL(file);

        audioPlayer.src = currentObjectURL;

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

    window.addEventListener("resize", resizeCanvas);


    // --------------------------------------------------
    // INITIALIZATION
    // --------------------------------------------------

    resizeCanvas();

    clearSpectrogram();

}

init();