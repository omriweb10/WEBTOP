import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Button } from '../../../../components/ui/Button';
import { Icon } from '../../../../components/ui/Icon';
import { Modal } from '../../../../components/ui/Modal';
import { clampCrop, INITIAL_CROP, MAX_ZOOM, type CropState } from '../../domain/avatarCrop';
import type { LoadedImage } from '../../domain/avatarImage';
import { CropView } from './CropView';
import styles from './avatar.module.css';

const FRAME = 280;

interface AvatarCropperProps {
  image: LoadedImage;
  busy: boolean;
  onSave: (crop: CropState, frame: number) => void;
  onCancel: () => void;
}

/** Drag to reposition, slider/buttons/keys to zoom, with round and square previews. */
export function AvatarCropper({ image, busy, onSave, onCancel }: AvatarCropperProps) {
  const [crop, setCrop] = useState<CropState>(INITIAL_CROP);
  const drag = useRef<{ x: number; y: number; start: CropState } | null>(null);

  /** Applies a change, keeping the frame covered. */
  const update = (next: CropState) => setCrop(clampCrop(next, image.width, image.height, FRAME));

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, start: crop };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start) return;
    update({ ...start.start, offsetX: start.start.offsetX + event.clientX - start.x, offsetY: start.start.offsetY + event.clientY - start.y });
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  /** Arrow keys pan, +/- zoom. */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 40 : 10;
    const moves: Record<string, Partial<CropState>> = {
      ArrowLeft: { offsetX: crop.offsetX - step },
      ArrowRight: { offsetX: crop.offsetX + step },
      ArrowUp: { offsetY: crop.offsetY - step },
      ArrowDown: { offsetY: crop.offsetY + step },
      '+': { zoom: crop.zoom + 0.1 },
      '=': { zoom: crop.zoom + 0.1 },
      '-': { zoom: crop.zoom - 0.1 },
    };
    const change = moves[event.key];
    if (!change) return;
    event.preventDefault();
    update({ ...crop, ...change });
  };

  return (
    <Modal
      open
      title="עריכת תמונת פרופיל"
      onClose={onCancel}
      footer={
        <>
          <Button variant="primary" disabled={busy} onClick={() => onSave(crop, FRAME)}>
            {busy ? 'שומר…' : 'שמירת התמונה'}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={onCancel}>
            ביטול
          </Button>
        </>
      }
    >
      <p className={styles.help}>גררו כדי למקם, והגדילו או הקטינו עם הסרגל.</p>
      <div
        className={styles.frame}
        style={{ width: FRAME, height: FRAME }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={(event) => update({ ...crop, zoom: crop.zoom - event.deltaY / 500 })}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="application"
        aria-label="אזור החיתוך: גררו או השתמשו בחצים כדי למקם, ובפלוס ומינוס כדי להגדיל"
      >
        <CropView image={image} crop={crop} frame={FRAME} size={FRAME} />
        <span className={styles.ring} aria-hidden="true" />
      </div>
      <div className={styles.zoomRow}>
        <button type="button" className={styles.zoomButton} aria-label="הקטנה" onClick={() => update({ ...crop, zoom: crop.zoom - 0.2 })}>
          <Icon name="zoomOut" size={22} />
        </button>
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={crop.zoom}
          onChange={(event) => update({ ...crop, zoom: Number(event.target.value) })}
          aria-label="הגדלה"
          className={styles.slider}
        />
        <button type="button" className={styles.zoomButton} aria-label="הגדלה" onClick={() => update({ ...crop, zoom: crop.zoom + 0.2 })}>
          <Icon name="zoomIn" size={22} />
        </button>
      </div>
      <div className={styles.previews}>
        <figure className={styles.preview}>
          <CropView image={image} crop={crop} frame={FRAME} size={88} round />
          <figcaption>עגולה</figcaption>
        </figure>
        <figure className={styles.preview}>
          <CropView image={image} crop={crop} frame={FRAME} size={88} />
          <figcaption>מרובעת</figcaption>
        </figure>
        <figure className={styles.preview}>
          <CropView image={image} crop={crop} frame={FRAME} size={40} round />
          <figcaption>בתפריט</figcaption>
        </figure>
      </div>
    </Modal>
  );
}
