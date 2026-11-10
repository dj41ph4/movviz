package com.movviz.nx.mobile.ui.profile

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas as AndroidCanvas
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import android.media.ExifInterface
import android.net.Uri
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.text.BasicText
import androidx.compose.ui.text.TextStyle
import com.movviz.nx.mobile.ui.theme.MovvizSurfaceStrong
import com.movviz.nx.mobile.ui.theme.hapticClickable
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import kotlin.math.max

private const val DECODE_MAX_SIDE = 2048

/** Décode l'image choisie (échantillonnée à ≤ 2048 px) et applique l'orientation EXIF. */
private suspend fun decodeForCrop(context: android.content.Context, uri: Uri): Bitmap? = withContext(Dispatchers.IO) {
    runCatching {
        val resolver = context.contentResolver
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return@runCatching null
        var sample = 1
        while (max(bounds.outWidth, bounds.outHeight) / sample > DECODE_MAX_SIDE) sample *= 2
        val opts = BitmapFactory.Options().apply { inSampleSize = sample }
        val raw = resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, opts) } ?: return@runCatching null
        val orientation = resolver.openInputStream(uri)?.use {
            ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
        } ?: ExifInterface.ORIENTATION_NORMAL
        val m = Matrix()
        when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> m.postRotate(90f)
            ExifInterface.ORIENTATION_ROTATE_180 -> m.postRotate(180f)
            ExifInterface.ORIENTATION_ROTATE_270 -> m.postRotate(270f)
            ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> m.postScale(-1f, 1f)
            ExifInterface.ORIENTATION_FLIP_VERTICAL -> m.postScale(1f, -1f)
            ExifInterface.ORIENTATION_TRANSPOSE -> { m.postRotate(90f); m.postScale(-1f, 1f) }
            ExifInterface.ORIENTATION_TRANSVERSE -> { m.postRotate(270f); m.postScale(-1f, 1f) }
            else -> Unit
        }
        if (m.isIdentity) raw else Bitmap.createBitmap(raw, 0, 0, raw.width, raw.height, m, true)
    }.getOrNull()
}

/** Produit l'image carrée 512×512 : PNG si l'image a de la transparence, sinon JPEG. */
private fun renderCropped(bitmap: Bitmap, viewport: Float, zoom: Float, x: Float, y: Float): Pair<ByteArray, String> {
    val r = AvatarCropMath.sourceRect(bitmap.width.toFloat(), bitmap.height.toFloat(), viewport, zoom, x, y)
    val out = Bitmap.createBitmap(AvatarCropMath.OUTPUT_PX, AvatarCropMath.OUTPUT_PX, Bitmap.Config.ARGB_8888)
    val canvas = AndroidCanvas(out)
    val paint = Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG)
    canvas.drawBitmap(
        bitmap,
        Rect(r.sx.toInt(), r.sy.toInt(), (r.sx + r.sw).toInt(), (r.sy + r.sh).toInt()),
        RectF(0f, 0f, AvatarCropMath.OUTPUT_PX.toFloat(), AvatarCropMath.OUTPUT_PX.toFloat()),
        paint,
    )
    val stream = ByteArrayOutputStream()
    return if (bitmap.hasAlpha()) {
        out.compress(Bitmap.CompressFormat.PNG, 100, stream)
        stream.toByteArray() to "image/png"
    } else {
        out.compress(Bitmap.CompressFormat.JPEG, 92, stream)
        stream.toByteArray() to "image/jpeg"
    }
}

/**
 * Fenêtre de recadrage de la photo de profil : glisser pour déplacer, pincer (ou curseur) pour zoomer.
 * Le cadre est circulaire comme l'affichage final ; l'image envoyée est un carré 512×512.
 */
@Composable
fun AvatarCropDialog(uri: Uri, onDismiss: () -> Unit, onConfirm: (bytes: ByteArray, mime: String) -> Unit) {
    val context = LocalContext.current
    var bitmap by remember { mutableStateOf<Bitmap?>(null) }
    var failed by remember { mutableStateOf(false) }
    LaunchedEffect(uri) {
        val b = decodeForCrop(context, uri)
        if (b == null) failed = true else bitmap = b
    }

    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        BoxWithConstraints(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
            val availableWidth = maxWidth
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(MovvizSurfaceStrong, RoundedCornerShape(20.dp))
                    .border(1.dp, Color.White.copy(alpha = 0.12f), RoundedCornerShape(20.dp))
                    .padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                BasicText("Recadrer la photo", style = TextStyle(color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold), modifier = Modifier.fillMaxWidth())
                BasicText(
                    "Glisse pour déplacer, pince ou utilise le curseur pour zoomer.",
                    style = TextStyle(color = Color(0xFFB7B5BF), fontSize = 14.sp),
                    modifier = Modifier.fillMaxWidth().padding(top = 6.dp, bottom = 16.dp),
                )
                val bmp = bitmap
                val density = LocalDensity.current
                val viewportDp = minOf(availableWidth - 72.dp, 300.dp)
                val viewportPx = with(density) { viewportDp.toPx() }
                if (bmp == null) {
                    Box(Modifier.size(viewportDp), contentAlignment = Alignment.Center) {
                        BasicText(if (failed) "Image illisible" else "Chargement…", style = TextStyle(color = Color(0xFFB7B5BF), fontSize = 14.sp))
                    }
                } else {
                    val iw = bmp.width.toFloat()
                    val ih = bmp.height.toFloat()
                    var zoom by remember(bmp) { mutableFloatStateOf(1f) }
                    var offset by remember(bmp) {
                        val o = AvatarCropMath.centeredOffset(iw, ih, viewportPx, 1f)
                        mutableStateOf(o)
                    }
                    fun applyZoom(target: Float) {
                        val z = AvatarCropMath.clampZoom(target)
                        offset = AvatarCropMath.zoomAroundCenter(iw, ih, viewportPx, zoom, z, offset.x, offset.y)
                        zoom = z
                    }
                    Box(
                        modifier = Modifier
                            .size(viewportDp)
                            .clip(CircleShape)
                            .border(2.dp, Color.White.copy(alpha = 0.55f), CircleShape)
                            .pointerInput(bmp) {
                                detectTransformGestures { _, pan, gestureZoom, _ ->
                                    if (gestureZoom != 1f) {
                                        val z = AvatarCropMath.clampZoom(zoom * gestureZoom)
                                        offset = AvatarCropMath.zoomAroundCenter(iw, ih, viewportPx, zoom, z, offset.x, offset.y)
                                        zoom = z
                                    }
                                    offset = AvatarCropMath.clampOffset(iw, ih, viewportPx, zoom, offset.x + pan.x, offset.y + pan.y)
                                }
                            },
                    ) {
                        Canvas(Modifier.size(viewportDp)) {
                            val r = AvatarCropMath.sourceRect(iw, ih, viewportPx, zoom, offset.x, offset.y)
                            drawIntoCanvas { c ->
                                c.nativeCanvas.drawBitmap(
                                    bmp,
                                    Rect(r.sx.toInt(), r.sy.toInt(), (r.sx + r.sw).toInt(), (r.sy + r.sh).toInt()),
                                    RectF(0f, 0f, size.width, size.height),
                                    Paint(Paint.FILTER_BITMAP_FLAG),
                                )
                            }
                        }
                    }
                    ZoomSlider(
                        value = (zoom - AvatarCropMath.MIN_ZOOM) / (AvatarCropMath.MAX_ZOOM - AvatarCropMath.MIN_ZOOM),
                        onChange = { applyZoom(AvatarCropMath.MIN_ZOOM + it * (AvatarCropMath.MAX_ZOOM - AvatarCropMath.MIN_ZOOM)) },
                        modifier = Modifier.padding(top = 18.dp).fillMaxWidth(),
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(top = 20.dp)) {
                        CropButton("Annuler", primary = false, modifier = Modifier.weight(1f), onClick = onDismiss)
                        CropButton("Utiliser cette photo", primary = true, modifier = Modifier.weight(1f)) {
                            val (bytes, mime) = renderCropped(bmp, viewportPx, zoom, offset.x, offset.y)
                            onConfirm(bytes, mime)
                        }
                    }
                }
                if (bmp == null) {
                    Row(Modifier.padding(top = 20.dp)) {
                        CropButton("Annuler", primary = false, modifier = Modifier.weight(1f), onClick = onDismiss)
                    }
                }
            }
        }
    }
}

/** Curseur de zoom 0..1 (pas de Material3 dans l'app : rendu maison, zone tactile de 44 dp). */
@Composable
private fun ZoomSlider(value: Float, onChange: (Float) -> Unit, modifier: Modifier = Modifier) {
    BoxWithConstraints(
        modifier = modifier
            .height(44.dp)
            .pointerInput(Unit) {
                detectTapGestures { p -> onChange((p.x / size.width).coerceIn(0f, 1f)) }
            }
            .pointerInput(Unit) {
                detectHorizontalDragGestures { change, _ ->
                    onChange((change.position.x / size.width).coerceIn(0f, 1f))
                }
            },
        contentAlignment = Alignment.CenterStart,
    ) {
        Box(Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp)).background(Color.White.copy(alpha = 0.18f)))
        Box(Modifier.fillMaxWidth(value.coerceIn(0f, 1f)).height(4.dp).clip(RoundedCornerShape(2.dp)).background(Color(0xFFA78BFA)))
        val thumb = 22.dp
        Box(
            Modifier
                .padding(start = (maxWidth - thumb) * value.coerceIn(0f, 1f))
                .size(thumb)
                .clip(CircleShape)
                .background(Color.White),
        )
    }
}

@Composable
private fun CropButton(label: String, primary: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Box(
        modifier = modifier
            .height(46.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(if (primary) Color(0xFF7C5CE0) else Color.White.copy(alpha = 0.10f))
            .hapticClickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        BasicText(label, style = TextStyle(color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.SemiBold))
    }
}
