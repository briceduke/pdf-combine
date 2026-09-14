"use client"

import * as React from "react"

/**
 * True when `element` intersects the viewport (with a small preload margin).
 *
 * @param elementRef - Element to observe.
 * @returns Whether the element is near the viewport.
 */
export function useInViewport(
  elementRef: React.RefObject<Element | null>
): boolean {
  const [isVisible, setIsVisible] = React.useState(false)

  React.useEffect(() => {
    const element = elementRef.current

    if (!element) {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
      },
      { rootMargin: "200px 0px" }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [elementRef])

  return isVisible
}
