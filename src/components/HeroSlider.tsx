/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from "react";
import { ChevronLeft, ChevronRight, Sparkles, ArrowRight } from "lucide-react";
import { resolveImageUrl } from "../App";

interface ShowcasePhoto {
  url: string;
  title: string;
  desc: string;
}

interface HeroSliderProps {
  showcasePhotos: ShowcasePhoto[];
}

export default function HeroSlider({ showcasePhotos }: HeroSliderProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -320, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 320, behavior: "smooth" });
    }
  };

  if (!showcasePhotos || showcasePhotos.length === 0) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2 relative" id="hero-slider-section">
      {/* Intro Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="text-left space-y-2">
          <span className="inline-flex items-center gap-1.5 bg-brand-900 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-xs">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Vitrina de Inspiración Exclusiva</span>
          </span>
          <h2 className="font-serif text-2xl sm:text-4xl font-bold tracking-tight text-brand-900">
            Nuestros Favoritos para tu Hogar & Cocina
          </h2>
          <p className="text-xs sm:text-sm text-brand-600 font-light leading-relaxed max-w-2xl">
            Deslizá manualmente hacia el costado para explorar nuestra selección destacada de artículos reales para renovar tu día a día.
          </p>
        </div>

        {/* Manual Scroll Buttons (Prev & Next arrows styled minimalist) */}
        {showcasePhotos.length > 1 && (
          <div className="flex gap-2 self-start md:self-end">
            <button
              onClick={scrollLeft}
              className="w-10 h-10 rounded-full border border-brand-300 bg-white hover:bg-brand-900 hover:text-white text-brand-800 transition-all flex items-center justify-center cursor-pointer shadow-xs active:scale-95 touch-manipulation"
              aria-label="Desplazar a la izquierda"
            >
              <ChevronLeft className="w-5 h-5 pointer-events-none" />
            </button>
            <button
              onClick={scrollRight}
              className="w-10 h-10 rounded-full border border-brand-300 bg-white hover:bg-brand-900 hover:text-white text-brand-800 transition-all flex items-center justify-center cursor-pointer shadow-xs active:scale-95 touch-manipulation"
              aria-label="Desplazar a la derecha"
            >
              <ChevronRight className="w-5 h-5 pointer-events-none" />
            </button>
          </div>
        )}
      </div>

      {/* Horizontal Sideways Scrollable Container */}
      <div
        ref={scrollContainerRef}
        className="flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth scrollbar-hide select-none pointer-events-auto"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch"
        }}
      >
        {showcasePhotos.map((item, idx) => {
          const resolvedUrl = resolveImageUrl(item.url);
          const isVideo = resolvedUrl.toLowerCase().endsWith(".mp4") || 
                          resolvedUrl.toLowerCase().endsWith(".webm") || 
                          resolvedUrl.includes("video") || 
                          resolvedUrl.startsWith("data:video");
          
          return (
            <div
              key={idx}
              className="snap-start shrink-0 w-[290px] sm:w-[360px] bg-white rounded-2xl border border-brand-200 overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 flex flex-col group text-left border-b-4 border-b-brand-900"
            >
              {/* Card Image/Video Container */}
              <div className="relative h-[220px] overflow-hidden bg-brand-50 flex items-center justify-center">
                {isVideo ? (
                  <video
                    src={resolvedUrl}
                    className="w-full h-full object-cover pointer-events-none"
                    autoPlay
                    muted
                    loop
                    playsInline
                  />
                ) : (
                  <img
                    src={resolvedUrl}
                    alt={item.title}
                    onError={(e) => {
                      e.currentTarget.src = "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=800&q=85";
                    }}
                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                )}
                <span className="absolute top-3 left-3 bg-brand-900/90 text-white text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md shadow-sm">
                  Destacado
                </span>
              </div>

              {/* Card Content info */}
              <div className="p-5 flex-grow flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-brand-500 block">
                    Selección del Mes
                  </span>
                  <h3 className="font-serif font-bold text-brand-900 text-base sm:text-lg leading-tight group-hover:text-brand-700 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs text-brand-600 font-light leading-relaxed line-clamp-3">
                    {item.desc}
                  </p>
                </div>

                <div className="pt-3 border-t border-brand-100 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-brand-400">
                    Hogar & Cocina
                  </span>
                  <a
                    href="#productos"
                    className="text-[11px] font-bold uppercase tracking-wider text-brand-900 hover:text-brand-700 transition-colors flex items-center gap-1.5 group"
                  >
                    <span>Ver catálogo</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cozy Micro Indicator for manual sweep guide */}
      <div className="mt-2 text-center text-[10px] font-mono text-brand-500 animate-pulse sm:hidden flex items-center justify-center gap-1">
        <span>← Desliza hacia los costados para ver de forma manual →</span>
      </div>
    </div>
  );
}
