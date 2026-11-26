async function init() {
    // DOM ELEMENTS
    const audioUpload = document.getElementById("audio-upload");
    const fileInfo = document.getElementById("file-info");
    const audioContainer = document.getElementById("audio-container");
    const audioFilename = document.getElementById("audio-filename");
    const audioPlayer = document.getElementById("audio-player");
    const appStatus = document.getElementById("app-status");
    // AUDIO FILE UPLOAD
    audioUpload.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }
        // Validate file extension
        const extension = file.name
            .split(".")
            .pop()
            .toLowerCase();
        if (extension !== "mp3" && extension !== "wav") {
            appStatus.textContent = "Invalid file format. Please upload an MP3 or WAV file.";
            audioUpload.value = "";
            return;
        }
        // Validate MIME type when available
        const validTypes = [
            "audio/mpeg",
            "audio/wav",
            "audio/x-wav",
            "audio/wave",
            ""
        ];
        if (!validTypes.includes(file.type)) {
            appStatus.textContent = "Invalid audio file type.";
            audioUpload.value = "";
            return;
        }
        // Create audio URL
        const audioURL = URL.createObjectURL(file);
        // Update interface
        audioPlayer.src = audioURL;
        audioFilename.textContent = file.name;
        fileInfo.textContent = file.name;
        audioContainer.hidden = false;
        appStatus.textContent = "";
    });
}

init();