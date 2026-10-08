'use client';

import Link from '@tiptap/extension-link';
import { EditorContent, useEditor as useTiptap, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  BoldIcon,
  Heading2Icon,
  Heading3Icon,
  Heading4Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  Redo2Icon,
  Undo2Icon,
} from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { Controller } from 'react-hook-form';

import { Toggle } from '@/admin/ui/toggle';
import type { RichTextField } from '@/core/content/fields';
import {
  EMPTY_RICH_TEXT,
  RICH_TEXT_HEADING_LEVELS,
  type RichTextDoc,
} from '@/core/content/rich-text';

import { useEditor } from '../editor-context';
import { FieldShell } from './field-shell';
import { controlId, type FieldControlProps } from './types';

/** Tiptap configured to produce exactly the node/mark types allowed by richTextDocSchema. */
const extensions = [
  StarterKit.configure({
    heading: { levels: [...RICH_TEXT_HEADING_LEVELS] },
    blockquote: false,
    code: false,
    codeBlock: false,
    horizontalRule: false,
    strike: false,
    underline: false,
    link: false,
  }),
  Link.configure({ openOnClick: false, autolink: true, protocols: ['mailto', 'tel'] }),
];

function ToolbarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Toggle
      size="sm"
      aria-label={label}
      pressed={Boolean(active)}
      onPressedChange={() => onClick()}
    >
      {children}
    </Toggle>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const href = window.prompt(
      'Link URL (https://…, /about, mailto:…). Leave empty to remove.',
      previous ?? '',
    );
    if (href === null) return;
    if (href === '') editor.chain().focus().unsetLink().run();
    else
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href, target: /^https?:\/\//.test(href) ? '_blank' : null })
        .run();
  };
  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap gap-0.5 border-b p-1">
      <ToolbarButton
        label="Bold"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <BoldIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <ItalicIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 2"
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2Icon />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 3"
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3Icon />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 4"
        active={editor.isActive('heading', { level: 4 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
      >
        <Heading4Icon />
      </ToolbarButton>
      <ToolbarButton
        label="Bulleted list"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <ListIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrderedIcon />
      </ToolbarButton>
      <ToolbarButton label="Link" active={editor.isActive('link')} onClick={setLink}>
        <LinkIcon />
      </ToolbarButton>
      <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()}>
        <Undo2Icon />
      </ToolbarButton>
      <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()}>
        <Redo2Icon />
      </ToolbarButton>
    </div>
  );
}

function RichTextInput({
  id,
  label,
  value,
  onChange,
  onBlur,
  readOnly,
}: {
  id: string;
  label: string;
  value: RichTextDoc;
  onChange: (doc: RichTextDoc) => void;
  onBlur: () => void;
  readOnly: boolean;
}) {
  const editor = useTiptap({
    extensions,
    content: value ?? EMPTY_RICH_TEXT,
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        id,
        'aria-label': label,
        role: 'textbox',
        'aria-multiline': 'true',
        class:
          'prose-admin min-h-32 px-3 py-2 text-sm outline-none [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_h4]:font-medium [&_ol]:list-decimal [&_ol]:ps-5 [&_ul]:list-disc [&_ul]:ps-5 [&_a]:text-primary [&_a]:underline [&_p]:my-1',
      },
    },
    onUpdate: ({ editor: instance }) => onChange(instance.getJSON() as RichTextDoc),
    onBlur: () => onBlur(),
  });

  // Sync external resets (Discard, revision restore) into the editor.
  useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(editor.getJSON());
    if (current !== JSON.stringify(value))
      editor.commands.setContent(value ?? EMPTY_RICH_TEXT, { emitUpdate: false });
  }, [editor, value]);

  return (
    <div className="focus-within:ring-ring/50 rounded-md border focus-within:ring-2">
      {editor && !readOnly ? <Toolbar editor={editor} /> : null}
      <EditorContent editor={editor} />
    </div>
  );
}

export function RichTextControl({
  name,
  field,
  label,
  contentPath,
}: FieldControlProps<RichTextField>) {
  const { readOnly } = useEditor();
  const id = controlId(name);
  return (
    <FieldShell
      id={id}
      name={name}
      label={label}
      help={field.help}
      required={field.required}
      shared={!field.localized}
      contentPath={contentPath}
    >
      <Controller
        name={name}
        render={({ field: control }) => (
          <RichTextInput
            id={id}
            label={label}
            value={control.value as RichTextDoc}
            onChange={control.onChange}
            onBlur={control.onBlur}
            readOnly={readOnly}
          />
        )}
      />
    </FieldShell>
  );
}
