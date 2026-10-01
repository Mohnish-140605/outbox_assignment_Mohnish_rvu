import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import type { Editor } from '@tiptap/core';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Redo,
  Strikethrough,
  Underline,
  Undo,
  Unlink,
  Trash2,
} from 'lucide-react';
import { getImageDataUrlBytes, getInlineImageBytes, MAX_INLINE_IMAGE_BYTES } from '../../lib/inlineImages';

interface RichTextToolbarProps {
  editor: Editor;
  onImageError: (message: string | null) => void;
}

interface ToolbarButtonProps {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
}

function ToolbarButton({ label, onClick, active = false, disabled = false, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded text-[var(--color-text-muted)] transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? 'bg-[var(--color-accent-light)] text-[var(--color-accent)]' : ''
      }`}
    >
      {children}
    </button>
  );
}

function normalizeLink(value: string): string | null {
  const candidate = value.trim();
  if (!candidate) return null;

  const url = /^(https?:|mailto:)/i.test(candidate) ? candidate : `https://${candidate}`;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? url : null;
  } catch {
    return null;
  }
}

export function RichTextToolbar({ editor, onImageError }: RichTextToolbarProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const openLinkEditor = () => {
    setLinkValue(String(editor.getAttributes('link').href ?? ''));
    setLinkError(null);
    setLinkOpen((current) => !current);
  };

  const applyLink = () => {
    const url = normalizeLink(linkValue);
    if (!url) {
      setLinkError('Enter a valid web or email link.');
      return;
    }

    editor.chain().focus().setLink({ href: url }).run();
    setLinkOpen(false);
    setLinkError(null);
  };

  const insertImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const supportedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!supportedTypes.includes(file.type)) {
      onImageError('Choose a PNG, JPEG, GIF, or WebP image.');
      return;
    }

    if (file.size + getInlineImageBytes(editor.getHTML()) > MAX_INLINE_IMAGE_BYTES) {
      onImageError('Embedded images cannot exceed 2 MB per email.');
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      if (mountedRef.current) onImageError('The selected image could not be read.');
    };
    reader.onload = () => {
      if (!mountedRef.current || typeof reader.result !== 'string') return;
      if (getImageDataUrlBytes(reader.result) !== file.size) {
        onImageError('The selected image could not be embedded.');
        return;
      }

      editor.chain().focus().setImage({ src: reader.result, alt: 'Inserted image' }).run();
      onImageError(null);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-[var(--color-border)] bg-gray-50 p-2">
      <div className="flex flex-wrap items-center gap-1">
        <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}><Undo className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}><Redo className="h-4 w-4" /></ToolbarButton>
        <span aria-hidden="true" className="mx-1 h-6 w-px bg-gray-300" />
        <ToolbarButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></ToolbarButton>
        <span aria-hidden="true" className="mx-1 h-6 w-px bg-gray-300" />
        <ToolbarButton label="Heading 1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="Heading 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-4 w-4" /></ToolbarButton>
        <span aria-hidden="true" className="mx-1 h-6 w-px bg-gray-300" />
        <ToolbarButton label="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></ToolbarButton>
        <span aria-hidden="true" className="mx-1 h-6 w-px bg-gray-300" />
        <ToolbarButton label="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="Justify" active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}><AlignJustify className="h-4 w-4" /></ToolbarButton>
        <span aria-hidden="true" className="mx-1 h-6 w-px bg-gray-300" />
        <ToolbarButton label="Link" active={editor.isActive('link')} onClick={openLinkEditor}><LinkIcon className="h-4 w-4" /></ToolbarButton>
        {editor.isActive('link') && <ToolbarButton label="Remove link" onClick={() => editor.chain().focus().unsetLink().run()}><Unlink className="h-4 w-4" /></ToolbarButton>}
        <ToolbarButton label="Upload image" onClick={() => imageInputRef.current?.click()}><ImagePlus className="h-4 w-4" /></ToolbarButton>
        {editor.isActive('image') && <ToolbarButton label="Remove image" onClick={() => editor.chain().focus().deleteSelection().run()}><Trash2 className="h-4 w-4" /></ToolbarButton>}
        <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={insertImage} aria-label="Choose an image" />
      </div>
      {linkOpen && (
        <div className="flex basis-full items-center gap-2 border-t border-[var(--color-border)] pt-2">
          <label className="sr-only" htmlFor="email-link-url">Link URL</label>
          <input
            id="email-link-url"
            type="text"
            value={linkValue}
            onChange={(event) => { setLinkValue(event.target.value); setLinkError(null); }}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); applyLink(); } }}
            placeholder="https://example.com"
            className="min-w-0 flex-1 rounded border border-[var(--color-border)] bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            autoFocus
          />
          <button type="button" onClick={applyLink} className="rounded bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-1">Apply</button>
          <button type="button" onClick={() => setLinkOpen(false)} className="rounded px-2 py-1.5 text-sm text-[var(--color-text-muted)] hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]">Cancel</button>
        </div>
      )}
      {linkError && <p className="basis-full px-1 text-xs text-red-700" role="alert">{linkError}</p>}
    </div>
  );
}