import { useEditor, EditorContent } from '@tiptap/react';
import { useEffect, useRef } from 'react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import { RichTextToolbar } from './RichTextToolbar';
import { getImageDataUrlBytes, getInlineImageBytes, MAX_INLINE_IMAGE_BYTES } from '../../lib/inlineImages';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  onValidationError?: (message: string | null) => void;
}

export function RichTextEditor({ value, onChange, onValidationError }: RichTextEditorProps) {
  const validationErrorRef = useRef(onValidationError);

  useEffect(() => {
    validationErrorRef.current = onValidationError;
  }, [onValidationError]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Write your email...' }),
      Link.configure({ openOnClick: false }),
      Underline,
      Image.configure({ allowBase64: true }),
      TextAlign.configure({
        types: ['paragraph', 'heading'],
        defaultAlignment: 'left',
      }),
    ],
    content: value,
    onUpdate: ({ editor: updatedEditor }) => onChange(updatedEditor.getHTML()),
    editorProps: {
      attributes: {
        'aria-label': 'Email body',
        class: 'prose prose-sm max-w-none min-h-[220px] px-4 py-3 focus:outline-none',
      },
      transformPastedHTML: (html) => {
        const pastedDocument = new DOMParser().parseFromString(html, 'text/html');
        let totalBytes = getInlineImageBytes(value);

        for (const image of Array.from(pastedDocument.querySelectorAll('img'))) {
          const source = image.getAttribute('src') ?? '';
          const bytes = getImageDataUrlBytes(source);
          if (bytes === null || totalBytes + bytes > MAX_INLINE_IMAGE_BYTES) {
            image.remove();
            validationErrorRef.current?.(
              bytes === null
                ? 'Paste images as local files using Upload image.'
                : 'Embedded images cannot exceed 2 MB per email.'
            );
            continue;
          }
          totalBytes += bytes;
        }

        return pastedDocument.body.innerHTML;
      },
    },
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) return null;

  return (
    <div className="overflow-hidden rounded-md border border-[var(--color-border)] bg-white focus-within:border-[var(--color-accent)] focus-within:ring-2 focus-within:ring-[var(--color-accent)]">
      <RichTextToolbar editor={editor} onImageError={(message) => onValidationError?.(message)} />
      <EditorContent editor={editor} />
    </div>
  );
}
