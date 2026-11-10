package com.movviz.nx.mobile.ui.profile

import kotlin.math.max
import kotlin.math.min

/**
 * Recadrage de la photo de profil — calculs purs, identiques à src/lib/avatarCrop.ts (web).
 * Le « viewport » est le carré visible (px) ; l'image est affichée à l'échelle
 * `coverScale × zoom`, décalée de (x, y) par rapport au coin haut-gauche du viewport.
 */
object AvatarCropMath {
    /** Taille maximale d'un fichier de photo de profil (serveur : 6 Mo). */
    const val MAX_BYTES = 6 * 1024 * 1024
    /** Côté (px) de l'image carrée envoyée après recadrage. */
    const val OUTPUT_PX = 512
    const val MIN_ZOOM = 1f
    const val MAX_ZOOM = 4f

    data class Point(val x: Float, val y: Float)
    data class SourceRect(val sx: Float, val sy: Float, val sw: Float, val sh: Float)

    fun coverScale(imageW: Float, imageH: Float, viewport: Float): Float =
        max(viewport / imageW, viewport / imageH)

    fun clampZoom(zoom: Float): Float = min(MAX_ZOOM, max(MIN_ZOOM, zoom))

    /** Garde l'image toujours recouvrante : aucun bord vide dans le cadre. */
    fun clampOffset(imageW: Float, imageH: Float, viewport: Float, zoom: Float, x: Float, y: Float): Point {
        val scale = coverScale(imageW, imageH, viewport) * zoom
        val minX = min(0f, viewport - imageW * scale)
        val minY = min(0f, viewport - imageH * scale)
        return Point(min(0f, max(minX, x)), min(0f, max(minY, y)))
    }

    fun centeredOffset(imageW: Float, imageH: Float, viewport: Float, zoom: Float): Point {
        val scale = coverScale(imageW, imageH, viewport) * zoom
        return clampOffset(imageW, imageH, viewport, zoom, (viewport - imageW * scale) / 2f, (viewport - imageH * scale) / 2f)
    }

    /** Change le zoom en gardant fixe le point au centre du cadre. */
    fun zoomAroundCenter(imageW: Float, imageH: Float, viewport: Float, fromZoom: Float, toZoom: Float, x: Float, y: Float): Point {
        val base = coverScale(imageW, imageH, viewport)
        val from = base * fromZoom
        val target = clampZoom(toZoom)
        val to = base * target
        val cx = (viewport / 2f - x) / from
        val cy = (viewport / 2f - y) / from
        return clampOffset(imageW, imageH, viewport, target, viewport / 2f - cx * to, viewport / 2f - cy * to)
    }

    /** Rectangle de l'image source qui correspond au cadre visible. */
    fun sourceRect(imageW: Float, imageH: Float, viewport: Float, zoom: Float, x: Float, y: Float): SourceRect {
        val scale = coverScale(imageW, imageH, viewport) * zoom
        val sw = viewport / scale
        return SourceRect(-x / scale, -y / scale, sw, sw)
    }
}
