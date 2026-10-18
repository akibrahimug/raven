"use client";

import { useEffect, useRef, useState } from "react";
import { Slab } from "@/components/Skeleton";

/** A raven's or reply's photo. Photos come through the storage server and
 *  can take a few seconds, so until one arrives a pulsing block holds its
 *  place — otherwise the raven looks like it has no photo at all. */
export function RavenPhoto({ src, className = "" }: { src: string; className?: string }) {
  const image = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);

  // Already in the browser's cache: it can finish before hydration, and then
  // onLoad never fires.
  useEffect(() => {
    if (image.current?.complete && image.current.naturalWidth > 0) setLoaded(true);
  }, []);

  return (
    <>
      {!loaded ? <Slab className={`h-44 w-full ${className}`} /> : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={image}
        src={src}
        alt=""
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={loaded ? className : "hidden"}
      />
    </>
  );
}
