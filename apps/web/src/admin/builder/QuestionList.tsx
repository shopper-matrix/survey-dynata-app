import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { SurveyDetails } from '../api';

type Block = SurveyDetails['definition']['blocks'][number];

interface QuestionListProps {
  blocks: Block[];
  canEdit: boolean;
  selected: string | null;
  onSelect: (code: string) => void;
  onAdd: (blockCode: string) => void;
  onReorder: (blockCode: string, codes: string[]) => void;
  onDeleteBlock: (blockCode: string) => void;
}

const move = <T,>(list: T[], from: number, to: number) => {
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
};

/** Blocks with their questions; drag to reorder, or use the arrow buttons (keyboard). */
export function QuestionList({
  blocks,
  canEdit,
  selected,
  onSelect,
  onAdd,
  onReorder,
  onDeleteBlock,
}: QuestionListProps) {
  const [dragging, setDragging] = useState<{ block: string; index: number } | null>(null);

  return (
    <div className="grid gap-6">
      {blocks.map((block) => {
        const codes = block.questions.map((q) => q.code);
        return (
          <section
            key={block.code}
            aria-labelledby={`block-${block.code}`}
            className="rounded-lg border"
          >
            <header className="flex items-center justify-between gap-2 border-b px-4 py-2">
              <h3 id={`block-${block.code}`} className="font-semibold">
                {block.code} · {block.title}
                {block.rotationGroup ? (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    rotated ({block.rotationGroup})
                  </span>
                ) : null}
              </h3>
              {canEdit && block.questions.length === 0 ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete block ${block.code}`}
                  onClick={() => {
                    onDeleteBlock(block.code);
                  }}
                >
                  <Trash2 />
                </Button>
              ) : null}
            </header>
            <ol className="divide-y">
              {block.questions.map((question, index) => (
                <li
                  key={question.code}
                  draggable={canEdit}
                  onDragStart={() => {
                    setDragging({ block: block.code, index });
                  }}
                  onDragOver={(event) => {
                    if (dragging?.block === block.code) event.preventDefault();
                  }}
                  onDrop={() => {
                    if (dragging?.block === block.code && dragging.index !== index) {
                      onReorder(block.code, move(codes, dragging.index, index));
                    }
                    setDragging(null);
                  }}
                  className={`flex items-center gap-2 px-2 py-1 ${selected === question.code ? 'bg-accent' : ''}`}
                >
                  {canEdit ? (
                    <GripVertical
                      aria-hidden
                      className="size-4 shrink-0 cursor-grab text-muted-foreground"
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(question.code);
                    }}
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="w-16 shrink-0 font-mono text-sm">{question.code}</span>
                    <span className="truncate">{question.text}</span>
                    <span className="ml-auto flex shrink-0 gap-1">
                      <Badge variant="outline">{question.type.replace(/_/g, ' ')}</Badge>
                      {question.isScreener ? <Badge variant="outline">screener</Badge> : null}
                      {question.isAttentionCheck ? (
                        <Badge variant="outline">attention</Badge>
                      ) : null}
                    </span>
                  </button>
                  {canEdit ? (
                    <span className="flex shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Move ${question.code} up`}
                        disabled={index === 0}
                        onClick={() => {
                          onReorder(block.code, move(codes, index, index - 1));
                        }}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Move ${question.code} down`}
                        disabled={index === codes.length - 1}
                        onClick={() => {
                          onReorder(block.code, move(codes, index, index + 1));
                        }}
                      >
                        <ArrowDown />
                      </Button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
            {canEdit ? (
              <div className="px-2 py-2">
                <Button
                  variant="ghost"
                  className="h-11"
                  onClick={() => {
                    onAdd(block.code);
                  }}
                >
                  <Plus aria-hidden />
                  Add question
                </Button>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
