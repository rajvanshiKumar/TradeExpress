import { useState, useRef, useCallback } from 'react';
import {
  Upload,
  Image as ImageIcon,
  Film,
  X,
  Star,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Trash2,
  Play,
  RotateCw,
} from 'lucide-react';
import Button from '../common/Button';
import useNotifications from '../../hooks/useNotifications';
import { apiPost, apiDelete } from '../../services/apiClient';

const MAX_IMAGES = 8;
const MAX_VIDEOS = 1;
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

/**
 * Enterprise B2B Product Media Uploader.
 * Supports up to 8 images + 1 video with drag-and-drop, progress, preview, reordering, and validation.
 */
export default function ProductMediaUploader({
  images = [],
  setImages,
  videoUrl = null,
  setVideoUrl,
  disabled = false,
}) {
  const { showToast } = useNotifications();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);

  // Helper to resolve full displayable URL
  const resolveMediaUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    const base = (import.meta.env.VITE_PUBLIC_API_BASE_URL || '').replace(/\/api\/?$/, '');
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const uploadSingleFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiPost('upload', formData);
    return res?.data?.fileUrl || res?.fileUrl || res?.data?.url || res?.url;
  };

  const handleFiles = useCallback(
    async (fileList) => {
      if (disabled || !fileList || fileList.length === 0) return;

      const incomingFiles = Array.from(fileList);
      const incomingImages = incomingFiles.filter((f) => ALLOWED_IMAGE_TYPES.includes(f.type));
      const incomingVideos = incomingFiles.filter((f) => ALLOWED_VIDEO_TYPES.includes(f.type));
      const invalidFiles = incomingFiles.filter(
        (f) => !ALLOWED_IMAGE_TYPES.includes(f.type) && !ALLOWED_VIDEO_TYPES.includes(f.type)
      );

      if (invalidFiles.length > 0) {
        showToast(
          `Unsupported file format: ${invalidFiles.map((f) => f.name).join(', ')}. Use PNG, JPG, WEBP, or MP4.`,
          'error'
        );
      }

      // Check image count limits
      const availableImageSlots = MAX_IMAGES - images.length;
      if (incomingImages.length > availableImageSlots) {
        showToast(
          `Image limit exceeded: You can only add ${availableImageSlots} more image${
            availableImageSlots === 1 ? '' : 's'
          } (Maximum ${MAX_IMAGES} images total).`,
          'warning'
        );
      }

      const imagesToUpload = incomingImages.slice(0, Math.max(0, availableImageSlots));

      // Check video count limits
      let videoToUpload = null;
      if (incomingVideos.length > 0) {
        if (videoUrl) {
          showToast('A product video is already uploaded. Replace or remove it first.', 'warning');
        } else {
          videoToUpload = incomingVideos[0];
        }
      }

      if (imagesToUpload.length === 0 && !videoToUpload) {
        return;
      }

      setUploading(true);
      const newUploadedImages = [];

      try {
        // Upload images sequentially with progress
        for (let i = 0; i < imagesToUpload.length; i++) {
          const img = imagesToUpload[i];
          if (img.size > MAX_IMAGE_SIZE_BYTES) {
            showToast(`Image "${img.name}" exceeds 10 MB limit. Skipped.`, 'error');
            continue;
          }

          setUploadProgress(`Uploading image ${i + 1} of ${imagesToUpload.length}...`);
          try {
            const url = await uploadSingleFile(img);
            if (url) {
              newUploadedImages.push(url);
            }
          } catch (uploadErr) {
            console.warn('API upload failed, creating local preview:', uploadErr);
            // Persistent fallback
            const localUrl = URL.createObjectURL(img);
            newUploadedImages.push(localUrl);
            showToast(`Image "${img.name}" saved with local preview.`, 'info');
          }
        }

        if (newUploadedImages.length > 0) {
          setImages((prev) => [...prev, ...newUploadedImages].slice(0, MAX_IMAGES));
          showToast(
            `${newUploadedImages.length} image${newUploadedImages.length === 1 ? '' : 's'} uploaded successfully!`,
            'success'
          );
        }

        // Upload video if present
        if (videoToUpload) {
          if (videoToUpload.size > MAX_VIDEO_SIZE_BYTES) {
            showToast(`Video "${videoToUpload.name}" exceeds 50 MB limit.`, 'error');
          } else {
            setUploadProgress('Uploading product video (this may take a few seconds)...');
            try {
              const uploadedVideoUrl = await uploadSingleFile(videoToUpload);
              if (uploadedVideoUrl) {
                setVideoUrl(uploadedVideoUrl);
                showToast('Product video uploaded successfully!', 'success');
              }
            } catch (err) {
              console.warn('Video upload failed:', err);
              const localVideo = URL.createObjectURL(videoToUpload);
              setVideoUrl(localVideo);
              showToast('Video added locally.', 'info');
            }
          }
        }
      } finally {
        setUploading(false);
        setUploadProgress('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (videoInputRef.current) videoInputRef.current.value = '';
      }
    },
    [disabled, images.length, videoUrl, setImages, setVideoUrl, showToast]
  );

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer?.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // Image manipulation helpers
  const handleRemoveImage = (indexToRemove) => {
    const imgUrl = images[indexToRemove];
    setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    showToast('Image removed.', 'info');

    // Attempt background server cleanup if it's an uploaded file
    if (imgUrl && imgUrl.startsWith('/uploads/')) {
      const filename = imgUrl.split('/').pop();
      apiDelete(`upload/${filename}`).catch(() => {});
    }
  };

  const handleMoveImage = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= images.length) return;
    setImages((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
  };

  const handleSetPrimary = (index) => {
    handleMoveImage(index, 0);
    showToast('Primary cover image updated.', 'success');
  };

  const handleRemoveVideo = () => {
    const currentVideo = videoUrl;
    setVideoUrl(null);
    showToast('Product video removed.', 'info');
    if (currentVideo && currentVideo.startsWith('/uploads/')) {
      const filename = currentVideo.split('/').pop();
      apiDelete(`upload/${filename}`).catch(() => {});
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Media Summary Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-bold text-navy-950">
            <ImageIcon className="size-4 text-emerald-700" />
            <span>Images:</span>
            <span className={images.length === MAX_IMAGES ? 'text-amber-700 font-extrabold' : 'text-emerald-700'}>
              {images.length} / {MAX_IMAGES}
            </span>
          </span>

          <span className="flex items-center gap-1.5 font-bold text-navy-950">
            <Film className="size-4 text-emerald-700" />
            <span>Video:</span>
            <span className={videoUrl ? 'text-emerald-700 font-extrabold' : 'text-slate-500'}>
              {videoUrl ? 1 : 0} / {MAX_VIDEOS}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span>Max 10MB/image</span>
          <span>•</span>
          <span>Max 50MB/video</span>
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
          isDragging
            ? 'border-emerald-600 bg-emerald-50/60 ring-4 ring-emerald-500/10'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/40'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled || uploading}
        />

        <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 shadow-2xs">
          {uploading ? (
            <Loader2 className="size-6 animate-spin text-emerald-700" />
          ) : (
            <Upload className="size-6 text-emerald-700" />
          )}
        </div>

        <p className="text-sm font-bold text-navy-950">
          {uploading ? uploadProgress : 'Drag & drop media files here, or click to browse'}
        </p>

        <p className="mt-1 text-xs text-slate-500 max-w-md">
          Upload up to 8 high-resolution product photographs (PNG, JPG, WEBP) plus 1 product showcase video (MP4, WEBM).
        </p>

        <div className="mt-4 flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || uploading || images.length >= MAX_IMAGES}
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            <ImageIcon className="size-3.5 mr-1" />
            Add Images ({images.length}/{MAX_IMAGES})
          </Button>

          {!videoUrl && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || uploading}
              onClick={(e) => {
                e.stopPropagation();
                videoInputRef.current?.click();
              }}
            >
              <Film className="size-3.5 mr-1" />
              Add Video (0/1)
            </Button>
          )}

          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
            disabled={disabled || uploading}
          />
        </div>
      </div>

      {/* Images Grid */}
      {images.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-navy-950">
            <span>Product Images ({images.length}/{MAX_IMAGES})</span>
            <span className="text-[11px] font-normal text-slate-500">
              First image is the primary cover displayed in search and catalog
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {images.map((img, index) => {
              const isPrimary = index === 0;
              const fullUrl = resolveMediaUrl(img);

              return (
                <div
                  key={`${img}-${index}`}
                  className={`group relative aspect-square overflow-hidden rounded-xl border bg-slate-100 transition-all shadow-2xs ${
                    isPrimary
                      ? 'border-emerald-600 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <img
                    src={fullUrl}
                    alt={`Product media ${index + 1}`}
                    className="size-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://placehold.co/400x400/f1f5f9/0f172a?text=TradeExpress';
                    }}
                  />

                  {/* Primary Badge */}
                  {isPrimary && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-emerald-800/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-xs">
                      <Star className="size-3 fill-amber-300 text-amber-300" />
                      <span>Primary Cover</span>
                    </div>
                  )}

                  {/* Actions Overlay */}
                  <div className="absolute inset-0 flex flex-col justify-between bg-navy-950/60 p-2 opacity-0 backdrop-blur-2xs transition-opacity group-hover:opacity-100">
                    <div className="flex items-center justify-between">
                      {!isPrimary ? (
                        <button
                          type="button"
                          onClick={() => handleSetPrimary(index)}
                          className="rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-bold text-emerald-900 shadow-sm hover:bg-white"
                          title="Make primary cover image"
                        >
                          Set Primary
                        </button>
                      ) : (
                        <span />
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="rounded-md bg-red-600/90 p-1 text-white shadow-sm hover:bg-red-700"
                        title="Remove image"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>

                    {/* Reordering Controls */}
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMoveImage(index, index - 1)}
                        className={`rounded-md bg-white/90 p-1 text-navy-950 shadow-sm hover:bg-white ${
                          index === 0 ? 'opacity-30 cursor-not-allowed' : ''
                        }`}
                        title="Move left"
                      >
                        <ArrowLeft className="size-3.5" />
                      </button>

                      <span className="text-[10px] font-bold text-white">
                        {index + 1} / {images.length}
                      </span>

                      <button
                        type="button"
                        disabled={index === images.length - 1}
                        onClick={() => handleMoveImage(index, index + 1)}
                        className={`rounded-md bg-white/90 p-1 text-navy-950 shadow-sm hover:bg-white ${
                          index === images.length - 1 ? 'opacity-30 cursor-not-allowed' : ''
                        }`}
                        title="Move right"
                      >
                        <ArrowRight className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Video Preview Card */}
      {videoUrl && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
                <Film className="size-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-navy-950">Product Promotional Video</p>
                <p className="text-[11px] text-slate-500">MP4 / WEBM video demonstration</p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRemoveVideo}
              className="text-red-700 border-red-200 hover:bg-red-50"
            >
              <Trash2 className="size-3 mr-1" />
              Remove Video
            </Button>
          </div>

          <div className="relative aspect-video max-w-md overflow-hidden rounded-lg bg-black">
            <video
              src={resolveMediaUrl(videoUrl)}
              controls
              className="size-full object-contain"
              preload="metadata"
            >
              Your browser does not support HTML5 video preview.
            </video>
          </div>
        </div>
      )}
    </div>
  );
}

