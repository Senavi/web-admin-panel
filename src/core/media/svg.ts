import { optimize } from 'svgo';

/**
 * Logo SVG sanitizer. svgo removes scripts, event handlers and javascript:
 * links; the checks below reject anything that could still load or execute
 * content. Sanitized SVGs are additionally served with a sandboxing CSP and
 * only ever used as <img> sources (where scripts never run).
 */
export const SVG_MAX_BYTES = 200 * 1024;

const FORBIDDEN = [
  /<script/i,
  /<foreignObject/i,
  /<iframe/i,
  /<embed/i,
  /<object/i,
  /<\?xml-stylesheet/i,
  /<!ENTITY/i,
  /\bon[a-z]+\s*=/i,
  /javascript:/i,
  /data:(?!image\/(png|jpeg|webp|gif);base64,)/i,
  /(?:href|src)\s*=\s*["']\s*(?:https?:)?\/\//i,
  /url\(\s*["']?\s*(?:https?:)?\/\//i,
  /@import/i,
];

export class SvgRejectedError extends Error {}

export function sanitizeSvg(source: string): string {
  if (Buffer.byteLength(source) > SVG_MAX_BYTES)
    throw new SvgRejectedError('SVG logos must be smaller than 200 KB.');
  let output: string;
  try {
    output = optimize(source, {
      multipass: true,
      plugins: ['preset-default', 'removeScripts', 'removeDimensions'],
    }).data;
  } catch {
    throw new SvgRejectedError('The SVG file could not be parsed.');
  }
  if (!/^<svg[\s>]/i.test(output.trim()))
    throw new SvgRejectedError('The file is not a valid SVG image.');
  if (FORBIDDEN.some((pattern) => pattern.test(output))) {
    throw new SvgRejectedError(
      'The SVG contains scripts, external references or embedded content and was rejected.',
    );
  }
  return output;
}
