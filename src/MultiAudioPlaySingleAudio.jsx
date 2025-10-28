import React, { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  Volume2,
  Download,
  SkipForward,
  Loader,
} from "lucide-react";

import rainSound from "./assets/rain-drops.mp3";
import musicSound from "./assets/Silent-Night.mp3";

function MultiAudioPlaySingleAudio() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [nameAudioFile, setNameAudioFile] = useState(null);
  const [scriptAudioFile, setScriptAudioFile] = useState(null);
  const [mergedAudioUrl, setMergedAudioUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volumes, setVolumes] = useState({
    rain: 0.05,
    music: 0.7,
    merged: 0.8,
  });

  const rainAudioRef = useRef(null);
  const musicAudioRef = useRef(null);
  const mergedAudioRef = useRef(null);
  const audioContextRef = useRef(null);

  useEffect(() => {
    if (rainAudioRef.current) {
      rainAudioRef.current.volume = volumes.rain;
    }
    if (musicAudioRef.current) {
      musicAudioRef.current.volume = volumes.music;
    }
    if (mergedAudioRef.current) {
      mergedAudioRef.current.volume = volumes.merged;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (mergedAudioUrl) {
        URL.revokeObjectURL(mergedAudioUrl);
      }
    };
  }, [mergedAudioUrl]);

  const handleNameAudioUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith("audio/")) {
      setNameAudioFile(file);
      setMergedAudioUrl(null);
    } else {
      alert("Please upload a valid audio file");
    }
  };

  const handleScriptAudioUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith("audio/")) {
      setScriptAudioFile(file);
      setMergedAudioUrl(null);
    } else {
      alert("Please upload a valid audio file");
    }
  };

  const mergeAudioFiles = async () => {
    if (!scriptAudioFile || !nameAudioFile) {
      alert("Please upload both script and name audio files");
      return;
    }

    setIsProcessing(true);

    try {
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      audioContextRef.current = audioContext;

      const [scriptBuffer, nameBuffer] = await Promise.all([
        loadAudioBuffer(audioContext, scriptAudioFile),
        loadAudioBuffer(audioContext, nameAudioFile),
      ]);

      const firstNamePosition = 39;
      const secondNamePosition = 259;

      const mergedBuffer = mergeBuffers(
        audioContext,
        scriptBuffer,
        nameBuffer,
        [firstNamePosition, secondNamePosition]
      );

      const wavBlob = bufferToWave(mergedBuffer, mergedBuffer.length);
      const url = URL.createObjectURL(wavBlob);

      setMergedAudioUrl(url);
      setIsProcessing(false);
    } catch (error) {
      console.error("Error merging audio:", error);
      alert("Error merging audio files. Please try again.");
      setIsProcessing(false);
    }
  };

  const loadAudioBuffer = async (audioContext, file) => {
    const arrayBuffer = await file.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
  };

  const mergeBuffers = (audioContext, scriptBuffer, nameBuffer, positions) => {
    const sampleRate = scriptBuffer.sampleRate;
    const channels = scriptBuffer.numberOfChannels;

    const outputBuffer = audioContext.createBuffer(
      channels,
      scriptBuffer.length,
      sampleRate
    );

    for (let channel = 0; channel < channels; channel++) {
      const scriptData = scriptBuffer.getChannelData(channel);
      const outputData = outputBuffer.getChannelData(channel);
      outputData.set(scriptData);
    }

    positions.forEach((position) => {
      const startSample = Math.floor(position * sampleRate);

      if (startSample + nameBuffer.length <= scriptBuffer.length) {
        for (
          let channel = 0;
          channel < Math.min(channels, nameBuffer.numberOfChannels);
          channel++
        ) {
          const nameData = nameBuffer.getChannelData(channel);
          const outputData = outputBuffer.getChannelData(channel);

          for (
            let i = 0;
            i < nameBuffer.length && startSample + i < scriptBuffer.length;
            i++
          ) {
            outputData[startSample + i] = Math.max(
              -1,
              Math.min(1, outputData[startSample + i] + nameData[i])
            );
          }
        }
      }
    });

    return outputBuffer;
  };

  const bufferToWave = (abuffer, len) => {
    const numOfChan = abuffer.numberOfChannels;
    const length = len * numOfChan * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let sample;
    let offset = 0;
    let pos = 0;

    setUint32(0x46464952);
    setUint32(length - 8);
    setUint32(0x45564157);
    setUint32(0x20746d66);
    setUint32(16);
    setUint16(1);
    setUint16(numOfChan);
    setUint32(abuffer.sampleRate);
    setUint32(abuffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2);
    setUint16(16);
    setUint32(0x61746164);
    setUint32(length - pos - 4);

    for (let i = 0; i < abuffer.numberOfChannels; i++) {
      channels.push(abuffer.getChannelData(i));
    }

    while (pos < length) {
      for (let i = 0; i < numOfChan; i++) {
        sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
        view.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }

    return new Blob([buffer], { type: "audio/wav" });

    function setUint16(data) {
      view.setUint16(pos, data, true);
      pos += 2;
    }

    function setUint32(data) {
      view.setUint32(pos, data, true);
      pos += 4;
    }
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      rainAudioRef.current?.pause();
      musicAudioRef.current?.pause();
      mergedAudioRef.current?.pause();
      setIsPlaying(false);
    } else {
      if (!mergedAudioUrl) {
        alert("Please merge the audio files first");
        return;
      }

      rainAudioRef.current
        ?.play()
        .catch((e) => console.error("Rain audio error:", e));
      musicAudioRef.current
        ?.play()
        .catch((e) => console.error("Music audio error:", e));
      mergedAudioRef.current
        ?.play()
        .catch((e) => console.error("Merged audio error:", e));
      setIsPlaying(true);
    }
  };

  const handleSkipForward = () => {
    if (mergedAudioRef.current) {
      const newTime = Math.min(
        mergedAudioRef.current.currentTime + 10,
        mergedAudioRef.current.duration
      );
      mergedAudioRef.current.currentTime = newTime;

      if (rainAudioRef.current)
        rainAudioRef.current.currentTime =
          newTime % rainAudioRef.current.duration;
      if (musicAudioRef.current)
        musicAudioRef.current.currentTime =
          newTime % musicAudioRef.current.duration;
    }
  };

  // const handleDownload = () => {
  //   if (!mergedAudioUrl) {
  //     alert("Please merge the audio files first");
  //     return;
  //   }

  //   const a = document.createElement("a");
  //   a.href = mergedAudioUrl;
  //   a.download = "merged-script.wav";
  //   document.body.appendChild(a);
  //   a.click();
  //   document.body.removeChild(a);
  // };

  const handleDownload = async () => {
    if (!mergedAudioUrl) {
      alert("Please merge the audio files first");
      return;
    }

    setIsProcessing(true);

    try {
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();

      const [mergedBuffer, rainBuffer, musicBuffer] = await Promise.all([
        fetch(mergedAudioUrl)
          .then((r) => r.arrayBuffer())
          .then((arr) => audioContext.decodeAudioData(arr)),
        fetch(rainSound)
          .then((r) => r.arrayBuffer())
          .then((arr) => audioContext.decodeAudioData(arr)),
        fetch(musicSound)
          .then((r) => r.arrayBuffer())
          .then((arr) => audioContext.decodeAudioData(arr)),
      ]);

      const duration = mergedBuffer.length;
      const sampleRate = mergedBuffer.sampleRate;
      const channels = mergedBuffer.numberOfChannels;

      const finalBuffer = audioContext.createBuffer(
        channels,
        duration,
        sampleRate
      );

      for (let channel = 0; channel < channels; channel++) {
        const finalData = finalBuffer.getChannelData(channel);
        const mergedData = mergedBuffer.getChannelData(channel);

        const rainData = rainBuffer.getChannelData(
          Math.min(channel, rainBuffer.numberOfChannels - 1)
        );
        const musicData = musicBuffer.getChannelData(
          Math.min(channel, musicBuffer.numberOfChannels - 1)
        );

        for (let i = 0; i < duration; i++) {
          const rainSample = rainData[i % rainBuffer.length] * volumes.rain;
          const musicSample = musicData[i % musicBuffer.length] * volumes.music;
          const mergedSample = mergedData[i] * volumes.merged;

          finalData[i] = Math.max(
            -1,
            Math.min(1, rainSample + musicSample + mergedSample)
          );
        }
      }

      const wavBlob = bufferToWave(finalBuffer, finalBuffer.length);
      const url = URL.createObjectURL(wavBlob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "complete-audio-with-background.wav";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      URL.revokeObjectURL(url);
      setIsProcessing(false);
    } catch (error) {
      console.error("Error creating download:", error);
      alert("Error creating download file. Please try again.");
      setIsProcessing(false);
    }
  };
  const handleVolumeChange = (track, value) => {
    const newVolume = parseFloat(value);
    setVolumes((prev) => ({ ...prev, [track]: newVolume }));

    if (track === "rain" && rainAudioRef.current) {
      rainAudioRef.current.volume = newVolume;
    } else if (track === "music" && musicAudioRef.current) {
      musicAudioRef.current.volume = newVolume;
    } else if (track === "merged" && mergedAudioRef.current) {
      mergedAudioRef.current.volume = newVolume;
    }
  };

  const handleTimeUpdate = () => {
    if (mergedAudioRef.current) {
      setCurrentTime(mergedAudioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (mergedAudioRef.current) {
      setDuration(mergedAudioRef.current.duration);
    }
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;

    if (mergedAudioRef.current && duration) {
      const newTime = percentage * duration;
      mergedAudioRef.current.currentTime = newTime;

      if (rainAudioRef.current)
        rainAudioRef.current.currentTime =
          newTime % rainAudioRef.current.duration;
      if (musicAudioRef.current)
        musicAudioRef.current.currentTime =
          newTime % musicAudioRef.current.duration;
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br bg-black p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20">
          <h1 className="text-4xl font-bold text-white mb-2 text-center">
            Audio Merge POC
          </h1>
          <p className="text-purple-200 text-center mb-8">
            Merge name audio with script at specific timestamps (39s & 4m 19s)
          </p>

          <div className="space-y-6">
            <div>
              <label className="block text-white mb-2 font-medium">
                Upload Script Audio File
              </label>
              <input
                type="file"
                accept="audio/*"
                onChange={handleScriptAudioUpload}
                className="w-full px-4 py-3 rounded-lg bg-white/20 text-white border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-500 file:text-white file:cursor-pointer hover:file:bg-blue-600"
              />
              {scriptAudioFile && (
                <p className="text-green-300 text-sm mt-2">
                  ✓ Script audio uploaded: {scriptAudioFile.name}
                </p>
              )}
            </div>

            <div>
              <label className="block text-white mb-2 font-medium">
                Upload Name Audio File
              </label>
              <input
                type="file"
                accept="audio/*"
                onChange={handleNameAudioUpload}
                className="w-full px-4 py-3 rounded-lg bg-white/20 text-white border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-500 file:text-white file:cursor-pointer hover:file:bg-blue-600"
              />
              {nameAudioFile && (
                <p className="text-green-300 text-sm mt-2">
                  ✓ Name audio uploaded: {nameAudioFile.name}
                </p>
              )}
            </div>

            <button
              onClick={mergeAudioFiles}
              disabled={isProcessing || !scriptAudioFile || !nameAudioFile}
              className="w-full py-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-xl"
            >
              {isProcessing ? (
                <>
                  <Loader className="animate-spin" size={24} />
                  Processing...
                </>
              ) : (
                "Merge Audio Files"
              )}
            </button>

            {mergedAudioUrl && (
              <>
                <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4">
                  <p className="text-green-100 text-sm">
                    ✓ Audio files merged successfully! You can now play with
                    background music or download.
                  </p>
                </div>

                <div className="bg-white/5 p-4 rounded-xl">
                  <div className="flex justify-between text-purple-200 text-sm mb-2">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                  <div
                    className="w-full h-2 bg-white/20 rounded-full cursor-pointer overflow-hidden"
                    onClick={handleSeek}
                  >
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                      style={{
                        width: `${
                          duration ? (currentTime / duration) * 100 : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-4 bg-white/5 p-6 rounded-xl">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Volume2 size={20} />
                Volume Controls
              </h3>

              <div>
                <label className="block text-purple-200 mb-2">
                  Rain Sound: {Math.round(volumes.rain * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volumes.rain}
                  onChange={(e) => handleVolumeChange("rain", e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-purple-200 mb-2">
                  Music: {Math.round(volumes.music * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volumes.music}
                  onChange={(e) => handleVolumeChange("music", e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-purple-200 mb-2">
                  Merged Script: {Math.round(volumes.merged * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volumes.merged}
                  onChange={(e) => handleVolumeChange("merged", e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={handlePlayPause}
                disabled={!mergedAudioUrl}
                className="col-span-2 py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-xl"
              >
                {isPlaying ? (
                  <>
                    <Pause size={24} />
                    Pause
                  </>
                ) : (
                  <>
                    <Play size={24} />
                    Play
                  </>
                )}
              </button>

              <button
                onClick={handleSkipForward}
                disabled={!mergedAudioUrl || !isPlaying}
                className="py-4 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:cursor-not-allowed text-black rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
              >
                <SkipForward size={24} />
                +10s
              </button>
            </div>

            <button
              onClick={handleDownload}
              disabled={!mergedAudioUrl}
              className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-xl"
            >
              <Download size={24} />
              Download Merged Audio
            </button>

            <div className="bg-white/5 rounded-lg p-4 space-y-2">
              <h4 className="text-white font-semibold">How it works:</h4>
              <ul className="text-purple-200 text-sm space-y-1 list-disc list-inside">
                <li>
                  Upload a script audio file (the main hypnosis/meditation
                  script)
                </li>
                <li>Upload an audio file containing a person's name</li>
                <li>
                  Click "Merge Audio Files" to create a single audio track
                </li>
                <li>
                  Name audio is mixed at 39 seconds and 4 minutes 19 seconds
                </li>
                <li>
                  Play the merged audio with background tracks (rain & music)
                </li>
                <li>Control individual volume levels for each track</li>
                <li>Download the merged audio file for offline use</li>
              </ul>
            </div>
          </div>

          <audio ref={rainAudioRef} loop preload="auto" src={rainSound} />
          <audio ref={musicAudioRef} loop preload="auto" src={musicSound} />
          {mergedAudioUrl && (
            <audio
              ref={mergedAudioRef}
              src={mergedAudioUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default MultiAudioPlaySingleAudio;
