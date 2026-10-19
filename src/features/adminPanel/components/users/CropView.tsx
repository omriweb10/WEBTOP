import { coverScale, type CropState } from '../../domain/avatarCrop';
import type { LoadedImage } from '../../domain/avatarImage';
import styles from './avatar.module.css';

interface CropViewProps {
  image: LoadedImage;
  crop: CropState;
  /** Size of the editing frame the offsets refer to. */
  frame: number;
  /** Size this view is drawn at. */
  size: number;
  round?: boolean;
}

/** Draws the cropped image at any size (the editor frame and the previews share it). */
export function CropView({ image, crop, frame, size, round }: CropViewProps) {
  const scale = coverScale(image.width, image.height, size) * crop.zoom;
  const ratio = size / frame;
  return (
    <span className={round ? styles.viewRound : styles.view} style={{ width: size, height: size }}>
      <img
        src={image.url}
        alt=""
        draggable={false}
        className={styles.viewImage}
        style={{
          width: image.width,
          height: image.height,
          transform: `translate(-50%, -50%) translate(${crop.offsetX * ratio}px, ${crop.offsetY * ratio}px) scale(${scale})`,
        }}
      />
    </span>
  );
}
