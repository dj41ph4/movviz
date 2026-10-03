"use client";

import { createContext } from "react";

// Only carousel logos are lazy. Hero/detail/hover logos keep eager loading.
export const CarouselImageContext = createContext(false);
