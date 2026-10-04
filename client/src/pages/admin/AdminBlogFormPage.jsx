import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Save,
  Send,
  ArrowLeft,
  Sparkles,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Tag,
  Loader2,
  Eye,
  Pencil,
  CalendarClock,
} from 'lucide-react';
import blogService from '../../services/blogService.js';
import { LoadingSpinner } from '../../components/LoadingSpinner.jsx';
import TagBadge from '../../components/TagBadge.jsx';
import MarkdownRenderer from '../../components/MarkdownRenderer.jsx';
import { formatBlogId } from '../../utils/formatBlogId.js';

export const AdminBlogFormPage = () => {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    tags: '',
    conclusion: '',
    status: 'Draft',
    scheduled_at: '',
    blog_id: '',
    image_url: '',
    image_public_id: '',
  });

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiKeywords, setAiKeywords] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Fetch existing blog data if editing
  useEffect(() => {
    if (isEditing) {
      const fetchBlog = async () => {
        try {
          setLoading(true);
          const data = await blogService.getAdminBlogById(id);
          if (data) {
            setFormData({
              title: data.title || '',
              content: data.content || '',
              tags: data.tags || '',
              conclusion: data.conclusion || '',
              status: data.status || 'Draft',
              scheduled_at: formatScheduledDateTime(data.scheduled_at),
              blog_id: data.blog_id || '',
              image_url: data.image_url || '',
              image_public_id: data.image_public_id || '',
            });
          }
        } catch (err) {
          console.error('Failed to load blog for editing:', err);
          setServerError('Failed to load blog from database.');
        } finally {
          setLoading(false);
        }
      };
      fetchBlog();
    }
  }, [id, isEditing]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(formData.image_url);
      return undefined;
    }

    const previewUrl = URL.createObjectURL(imageFile);
    setImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [imageFile, formData.image_url]);

  const formatScheduledDateTime = (value) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    const adjusted = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
    return adjusted.toISOString().slice(0, 16);
  };

  const toDatabaseScheduledAt = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 19).replace('T', ' ');
  };

  const validate = (status = formData.status) => {
    const errs = {};
    if (!formData.title.trim()) {
      errs.title = 'Title is required';
    } else if (formData.title.trim().length < 3) {
      errs.title = 'Title must be at least 3 characters long';
    } else if (formData.title.trim().length > 255) {
      errs.title = 'Title cannot exceed 255 characters';
    }

    if (!formData.content.trim()) {
      errs.content = 'Main blog content is required';
    }

    if (!formData.tags.trim()) {
      errs.tags = 'At least one tag is required (e.g. Technology, React)';
    }

    if (!formData.conclusion.trim()) {
      errs.conclusion = 'Conclusion summary is required';
    }

    if (!['Draft', 'Scheduled', 'Published'].includes(status)) {
      errs.status = "Status must be either 'Draft', 'Scheduled', or 'Published'";
    }

    if (status === 'Scheduled') {
      if (!formData.scheduled_at) {
        errs.scheduled_at = 'Select a date and time for scheduled publication';
      } else if (Number.isNaN(new Date(formData.scheduled_at).getTime())) {
        errs.scheduled_at = 'Scheduled publish date and time is invalid';
      }
    }

    if (imageFile && imageFile.size > 5 * 1024 * 1024) {
      errs.image = 'Image must be 5 MB or smaller';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (overrideStatus) => {
    const targetStatus = overrideStatus || formData.status;
    const submissionPayload = {
      ...formData,
      status: targetStatus,
      scheduled_at: targetStatus === 'Scheduled' ? toDatabaseScheduledAt(formData.scheduled_at) : null,
      image_file: imageFile,
    };

    setServerError('');
    setSuccessMessage('');

    if (!validate(targetStatus)) {
      return;
    }

    try {
      setSubmitting(true);
      if (isEditing) {
        await blogService.updateBlog(id, submissionPayload);
        setSuccessMessage('Blog updated successfully in MySQL!');
      } else {
        const created = await blogService.createBlog(submissionPayload);
        setSuccessMessage('Blog created successfully in MySQL!');
      }

      setTimeout(() => {
        navigate('/admin/blogs');
      }, 1200);
    } catch (err) {
      console.error('Submit blog error:', err);
      setServerError(err.message || 'Failed to save blog to MySQL database.');
    } finally {
      setSubmitting(false);
    }
  };

  // AI Blog Generator Assistant (SRS Page 1 & 6)
  const handleGenerateAi = async () => {
    if (!aiPrompt.trim()) return;
    setServerError('');
    try {
      setAiGenerating(true);
      const generated = await blogService.generateAiBlog(aiPrompt, aiKeywords);
      if (generated) {
        setFormData((prev) => ({
          ...prev,
          title: generated.title || prev.title,
          content: generated.content || prev.content,
          tags: generated.tags || prev.tags,
          conclusion: generated.conclusion || prev.conclusion,
          image_url: generated.image_url,
          image_public_id: generated.image_public_id,
        }));
        setImageFile(null);
        setAiModalOpen(false);
        setAiPrompt('');
        setAiKeywords('');
        setSuccessMessage('AI Draft generated successfully! You can now review and edit before saving.');
        setTimeout(() => setSuccessMessage(''), 5000);
      }
    } catch (err) {
      console.error('AI generation error:', err);
      const partialBlog = err.data?.data;
      if (partialBlog?.title && partialBlog?.content) {
        setFormData((prev) => ({
          ...prev,
          title: partialBlog.title || prev.title,
          content: partialBlog.content || prev.content,
          tags: partialBlog.tags || prev.tags,
          conclusion: partialBlog.conclusion || prev.conclusion,
        }));
        setServerError(
          `${err.message || 'AI image generation failed.'} The generated text is available; retry AI generation or choose an image manually.`
        );
      } else {
        setServerError(err.message || 'AI generation failed. Please try again.');
      }
    } finally {
      setAiGenerating(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Retrieving blog data from MySQL..." />;
  }

  const tagsArray = formData.tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/admin/blogs"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to All Blogs
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {isEditing
              ? `Edit Blog #${formData.blog_id ? formatBlogId(formData) : formatBlogId({ id })}`
              : 'Create New Blog Post'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isEditing
              ? 'Update blog content, modify tags, or change publication state.'
              : 'Write and publish high-quality articles for the Utsanova community.'}
          </p>
        </div>

        {/* AI Generator Button (SRS Reference Feature) */}
        <button
          type="button"
          onClick={() => setAiModalOpen(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all self-start sm:self-auto"
        >
          <Sparkles className="w-4 h-4 text-violet-200" />
          AI Blog Assistant
        </button>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {serverError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      {/* Main Blog Form Card */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/90 shadow-xs space-y-6">
        {/* Title */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Blog Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => {
              setFormData({ ...formData, title: e.target.value });
              if (errors.title) setErrors({ ...errors, title: null });
            }}
            placeholder="e.g. Modern Full-Stack System Design with Node.js and React"
            className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all ${
              errors.title
                ? 'border-red-300 focus:ring-red-400'
                : 'border-slate-200 focus:ring-indigo-500'
            }`}
          />
          {errors.title && (
            <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.title}
            </p>
          )}
        </div>

        {/* Tags */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Tags / Keywords <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.tags}
            onChange={(e) => {
              setFormData({ ...formData, tags: e.target.value });
              if (errors.tags) setErrors({ ...errors, tags: null });
            }}
            placeholder="e.g. Technology, Web Development, Education, React"
            className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all ${
              errors.tags
                ? 'border-red-300 focus:ring-red-400'
                : 'border-slate-200 focus:ring-indigo-500'
            }`}
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-[11px] text-slate-400">
              Separate tags with commas. Example: Technology, Education, Career
            </p>
            {tagsArray.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tagsArray.map((t, idx) => (
                  <TagBadge key={idx} tag={t} size="xs" />
                ))}
              </div>
            )}
          </div>
          {errors.tags && (
            <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.tags}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Blog Image
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(event) => {
              const file = event.target.files?.[0] || null;
              if (file && !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
                setErrors((current) => ({
                  ...current,
                  image: 'Upload a JPEG, PNG, WebP, or GIF image.',
                }));
                event.target.value = '';
                return;
              }
              setErrors((current) => ({ ...current, image: null }));
              setImageFile(file);
            }}
            className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
          />
          <p className="mt-1.5 text-[11px] text-slate-400">
            JPEG, PNG, WebP, or GIF; maximum 5 MB. Images are stored in Cloudinary.
          </p>
          {errors.image && (
            <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.image}
            </p>
          )}
          {imagePreview && (
            <img
              src={imagePreview}
              alt="Blog image preview"
              className="mt-3 max-h-56 rounded-xl object-contain"
            />
          )}
        </div>

        {/* Main Content Body (Markdown Supported) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Main Blog Content <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  !showPreview ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Pencil className="w-3.5 h-3.5" />
                Write
              </button>
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  showPreview ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Preview
              </button>
            </div>
          </div>

          {showPreview ? (
            <div
              className={`w-full min-h-[260px] p-4 bg-white border rounded-xl overflow-y-auto ${
                errors.content ? 'border-red-300' : 'border-slate-200'
              }`}
            >
              {formData.content.trim() ? (
                <MarkdownRenderer content={formData.content} />
              ) : (
                <p className="text-slate-400 text-sm italic">
                  Nothing to preview yet. Switch to Write mode and enter some Markdown.
                </p>
              )}
            </div>
          ) : (
            <textarea
              rows={10}
              value={formData.content}
              onChange={(e) => {
                setFormData({ ...formData, content: e.target.value });
                if (errors.content) setErrors({ ...errors, content: null });
              }}
              placeholder={'Write the full blog body here using Markdown...\n\n# Heading\n## Subheading\n**Bold**  *Italic*\n- Bullet list\n1. Numbered list\n> Blockquote\n[Link text](https://example.com)\n```code block```'}
              className={`w-full p-4 bg-slate-50 border rounded-xl text-slate-900 placeholder:text-slate-400 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:bg-white transition-all font-mono ${
                errors.content
                  ? 'border-red-300 focus:ring-red-400'
                  : 'border-slate-200 focus:ring-indigo-500'
              }`}
            />
          )}

          <div className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-500">
            <HelpCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
            <span>
              Markdown supported: <code className="bg-slate-100 px-1 rounded"># Heading</code>,{' '}
              <code className="bg-slate-100 px-1 rounded">**Bold**</code>,{' '}
              <code className="bg-slate-100 px-1 rounded">*Italic*</code>, bullet lists, numbered lists,{' '}
              <code className="bg-slate-100 px-1 rounded">&gt; Quote</code>,{' '}
              <code className="bg-slate-100 px-1 rounded">[Links](url)</code>, and{' '}
              <code className="bg-slate-100 px-1 rounded">```code```</code>. Use the Preview tab to see the formatted result.
            </span>
          </div>

          {errors.content && (
            <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.content}
            </p>
          )}
        </div>

        {/* Conclusion */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Conclusion / Key Takeaway <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={3}
            value={formData.conclusion}
            onChange={(e) => {
              setFormData({ ...formData, conclusion: e.target.value });
              if (errors.conclusion) setErrors({ ...errors, conclusion: null });
            }}
            placeholder="Summarize the core takeaways or concluding thoughts..."
            className={`w-full p-4 bg-slate-50 border rounded-xl text-slate-900 placeholder:text-slate-400 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:bg-white transition-all ${
              errors.conclusion
                ? 'border-red-300 focus:ring-red-400'
                : 'border-slate-200 focus:ring-indigo-500'
            }`}
          />
          {errors.conclusion && (
            <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.conclusion}
            </p>
          )}
        </div>

        {/* Publication Status Selector */}
        <div className="pt-2">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Publication Status
          </label>
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="status"
                value="Draft"
                checked={formData.status === 'Draft'}
                onChange={() =>
                  setFormData({
                    ...formData,
                    status: 'Draft',
                    scheduled_at: '',
                  })
                }
                className="text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <span className="text-sm font-medium text-slate-700">
                Draft <span className="text-xs text-slate-400">(Saved in MySQL, hidden from public)</span>
              </span>
            </label>

            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="status"
                value="Scheduled"
                checked={formData.status === 'Scheduled'}
                onChange={() =>
                  setFormData((prev) => ({
                    ...prev,
                    status: 'Scheduled',
                    scheduled_at: prev.scheduled_at || '',
                  }))
                }
                className="text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <span className="text-sm font-medium text-slate-700">
                Scheduled <span className="text-xs text-slate-400">(Publishes automatically on a chosen future date)</span>
              </span>
            </label>

            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="status"
                value="Published"
                checked={formData.status === 'Published'}
                onChange={() =>
                  setFormData({
                    ...formData,
                    status: 'Published',
                    scheduled_at: '',
                  })
                }
                className="text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <span className="text-sm font-medium text-slate-700">
                Published <span className="text-xs text-slate-400">(Publicly visible to visitors)</span>
              </span>
            </label>
          </div>

          {formData.status === 'Scheduled' && (
            <div className="mt-4">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Schedule publish date & time
              </label>
              <input
                type="datetime-local"
                value={formData.scheduled_at}
                onChange={(e) => {
                  setFormData({ ...formData, scheduled_at: e.target.value });
                  if (errors.scheduled_at) {
                    setErrors({ ...errors, scheduled_at: null });
                  }
                }}
                className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                  errors.scheduled_at
                    ? 'border-red-300 focus:ring-red-400'
                    : 'border-slate-200 focus:ring-indigo-500'
                }`}
              />
              {errors.scheduled_at && (
                <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.scheduled_at}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/blogs')}
            className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-xs rounded-xl transition-colors"
          >
            Cancel
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {/* Save as Draft */}
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit('Draft')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold rounded-xl transition-all shadow-xs disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              Save as Draft
            </button>

            {/* Schedule publish */}
            <button
              type="button"
              disabled={submitting || formData.status !== 'Scheduled'}
              onClick={() => handleSubmit('Scheduled')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-fuchsia-50 hover:bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200 text-xs font-bold rounded-xl transition-all shadow-xs disabled:opacity-50"
            >
              <CalendarClock className="w-3.5 h-3.5" />
              Schedule Publish
            </button>

            {/* Publish or Update */}
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit('Published')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving to MySQL...
                </>
              ) : isEditing ? (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Update & Publish
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Publish Now
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* AI Assistant Modal (SRS Reference Diagram Feature) */}
      {aiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="p-2 rounded-xl bg-violet-100 text-violet-700">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  AI Blog Generator (Future Enhancement SRS)
                </h3>
                <p className="text-xs text-slate-500">
                  Automatically generate structured draft (Title, Content, Tags & Conclusion)
                </p>
              </div>
            </div>

            <div className="space-y-4 my-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Topic or Prompt
                </label>
                <input
                  type="text"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g. Scaling Express & MySQL for high concurrency"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Target Keywords (Optional)
                </label>
                <input
                  type="text"
                  value={aiKeywords}
                  onChange={(e) => setAiKeywords(e.target.value)}
                  placeholder="e.g. MySQL, Node.js, Performance, Engineering"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setAiModalOpen(false)}
                disabled={aiGenerating}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={aiGenerating || !aiPrompt.trim()}
                onClick={handleGenerateAi}
                className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
              >
                {aiGenerating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Generating structured content...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Generate Draft
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBlogFormPage;
