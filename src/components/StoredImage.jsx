import { useImageUrl } from '../hooks/useImageUrl';

/**
 * A <div> whose background is a stored image (bucket path, older public URL or
 * external link). Takes any <div> props. Shows no background until the link is
 * ready, and none if `value` is empty.
 */
export const StoredBackground = ({ value, style, children, ...rest }) => {
  const url = useImageUrl(value);
  return (
    <div
      {...rest}
      style={{ ...style, ...(url ? { backgroundImage: `url(${JSON.stringify(url)})` } : {}) }}
    >
      {children}
    </div>
  );
};

/** An <img> for a stored image. Renders nothing until the link is ready. */
export const StoredImg = ({ value, alt = '', ...rest }) => {
  const url = useImageUrl(value);
  return url ? <img src={url} alt={alt} {...rest} /> : null;
};
