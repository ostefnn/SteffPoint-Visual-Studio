/** Copy a rendered visual to the clipboard as a PNG, to paste it straight into a post, chat or e-mail. */

export function canCopyImages(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.clipboard?.write && typeof ClipboardItem !== 'undefined';
}

/**
 * `render` starts at once: Safari only accepts a clipboard write started during the click, so the
 * ClipboardItem is built immediately with a promise of the image rather than after rendering.
 */
export async function copyImage(render: () => Promise<Blob>): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': render() })]);
}
