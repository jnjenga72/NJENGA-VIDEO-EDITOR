import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Scissors, Type, Music, Download, Upload } from 'lucide-react';

export default function App() {
  const [videoFile, setVideoFile] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [text, setText] = useState('Your Subtitle Here');
  const [trim, setTrim] = useState({ start: 0, end: 10 });
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setVideoFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleExport = async () => {
    const formData = new FormData();
    formData.append('video', videoFile);
    if (audioFile) formData.append('audio', audioFile);
    formData.append('text', text);
    formData.append('start', trim.start);
    formData.append('duration', trim.end - trim.start);

    const response = await fetch('http://localhost:5000/api/export', {
      method: 'POST',
      body: formData,
    });
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "edited-video.mp4";
    a.click();
  };

  return (
    <div className="h-screen w-full flex flex-col bg-[#121212] text-zinc-300 font-sans">
      {/* Top Navigation */}
      <nav className="h-14 border-b border-zinc-800 flex items-center justify-between px-6 bg-[#1a1a1a]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <Scissors size={18} className="text-white" />
          </div>
          <span className="font-bold text-white tracking-tight">WebEdit Pro</span>
        </div>
        <button 
          onClick={handleExport}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-2"
        >
          <Download size={16} /> Export MP4
        </button>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Toolbar */}
        <aside className="w-64 border-r border-zinc-800 p-4 flex flex-col gap-6 bg-[#1a1a1a]">
          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase mb-3 block">Media</label>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-700 rounded-lg cursor-pointer hover:bg-zinc-800 transition">
              <Upload size={24} className="mb-2 text-zinc-500" />
              <span className="text-xs">Upload Video</span>
              <input type="file" className="hidden" accept="video/*" onChange={handleFileChange} />
            </label>
          </div>

          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase mb-2 block">Text Overlay</label>
            <div className="flex items-center gap-2 bg-zinc-900 p-2 rounded border border-zinc-700">
              <Type size={16} className="text-zinc-500" />
              <input 
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="bg-transparent text-sm w-full outline-none" 
                placeholder="Type here..."
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase mb-3 block">Background Music</label>
            <input 
              type="file" 
              accept="audio/*" 
              className="text-xs text-zinc-500 file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-zinc-800 file:text-zinc-300"
              onChange={(e) => setAudioFile(e.target.files[0])}
            />
          </div>
        </aside>

        {/* Main Preview Area */}
        <main className="flex-1 flex flex-col relative bg-black">
          <div className="flex-1 flex items-center justify-center p-12">
            {previewUrl ? (
              <div className="relative group max-h-full">
                <video 
                  ref={videoRef}
                  src={previewUrl} 
                  className="max-h-[60vh] rounded shadow-2xl border border-zinc-800"
                />
                {/* Dynamic Preview Overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <h2 className="text-white text-3xl font-bold drop-shadow-[0_2px_10px_rgba(0,0,0,1)]">{text}</h2>
                </div>
              </div>
            ) : (
              <div className="text-zinc-600 flex flex-col items-center gap-2">
                <Play size={48} />
                <p>Upload a video to start editing</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Timeline Editor UI */}
      <footer className="h-64 bg-[#1a1a1a] border-t border-zinc-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-4">
            <button className="p-2 hover:bg-zinc-800 rounded transition"><Play size={20}/></button>
            <button className="p-2 hover:bg-zinc-800 rounded transition"><Scissors size={20}/></button>
          </div>
          <div className="text-xs font-mono text-zinc-500">00:00:0{trim.start} / 00:00:10</div>
        </div>
        
        <div className="space-y-4">
          {/* Video Track */}
          <div className="flex items-center gap-4">
            <div className="w-20 text-[10px] font-bold text-zinc-600 uppercase">Video</div>
            <div className="flex-1 h-12 bg-blue-900/20 border border-blue-500/30 rounded relative overflow-hidden">
              <div className="absolute inset-y-0 bg-blue-500/40 border-x border-blue-400" style={{left: '0%', right: '40%'}}>
                <div className="p-2 text-[10px] text-blue-200 truncate">{videoFile?.name || 'video_clip_1.mp4'}</div>
              </div>
            </div>
          </div>

          {/* Audio Track */}
          <div className="flex items-center gap-4">
            <div className="w-20 text-[10px] font-bold text-zinc-600 uppercase">Audio</div>
            <div className="flex-1 h-12 bg-emerald-900/20 border border-emerald-500/30 rounded relative">
              {audioFile && (
                <div className="absolute inset-y-0 left-0 w-full bg-emerald-500/40 p-2 text-[10px] text-emerald-200 truncate">{audioFile.name}</div>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}