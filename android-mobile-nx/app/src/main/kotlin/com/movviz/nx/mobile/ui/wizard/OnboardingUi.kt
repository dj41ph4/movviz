package com.movviz.nx.mobile.ui.wizard

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import com.movviz.nx.mobile.ui.theme.AnimatedLogo
import com.movviz.nx.mobile.ui.theme.MovvizBrand
import com.movviz.nx.mobile.ui.theme.MovvizBrand2
import com.movviz.nx.mobile.ui.theme.MovvizInkDim
import com.movviz.nx.mobile.ui.theme.MovvizWordmark
import com.movviz.nx.mobile.ui.theme.hapticClickable
import com.movviz.nx.mobile.ui.theme.tvPointerClick

val OnboardingCardShape = RoundedCornerShape(26.dp)
val OnboardingFieldShape = RoundedCornerShape(14.dp)
val OnboardingCtaShape = RoundedCornerShape(14.dp)

/** Fond premier démarrage : page unique + deux halos violets (haut-gauche, bas-droit). */
@Composable
fun OnboardingBackground(content: @Composable BoxScope.() -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(com.movviz.nx.mobile.ui.theme.MovvizPage),
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.radialGradient(
                        colors = listOf(
                            MovvizBrand.copy(alpha = 0.30f),
                            Color.Transparent,
                        ),
                        center = androidx.compose.ui.geometry.Offset(120f, 0f),
                        radius = 900f,
                    ),
                ),
        )
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.radialGradient(
                        colors = listOf(
                            MovvizBrand2.copy(alpha = 0.16f),
                            Color.Transparent,
                        ),
                        center = androidx.compose.ui.geometry.Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY),
                        radius = 1100f,
                    ),
                ),
        )
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center,
            content = content,
        )
    }
}

/** En-tête commun : logo + wordmark. */
@Composable
fun ColumnScope.OnboardingHeader(wordmarkSize: androidx.compose.ui.unit.TextUnit = 22.sp) {
    AnimatedLogo(size = 52.dp)
    Spacer(Modifier.height(8.dp))
    MovvizWordmark(fontSize = wordmarkSize)
}

/** Titre + sous-titre centrés façon maquette. */
@Composable
fun ColumnScope.OnboardingTitles(title: String, subtitle: String) {
    Text(
        text = title,
        style = TextStyle(
            fontSize = 24.sp,
            fontWeight = FontWeight.ExtraBold,
            color = Color.White,
            textAlign = TextAlign.Center,
            lineHeight = 30.sp,
        ),
        modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
    )
    Spacer(Modifier.height(8.dp))
    Text(
        text = subtitle,
        style = TextStyle(fontSize = 15.sp, color = Color.White.copy(alpha = 0.72f), textAlign = TextAlign.Center, lineHeight = 21.sp),
        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp),
    )
}

/**
 * Largeur à partir de laquelle le formulaire se pose dans une carte : tablette,
 * Z Fold déplié, téléphone en paysage. En dessous (téléphone portrait, Z Fold
 * replié) il occupe la page, sans cadre qui mange la largeur utile.
 */
const val OnboardingCardMinWidthDp = 600

/** Carte sombre arrondie (grands écrans) ou page nue (téléphone étroit) qui porte le formulaire. */
@Composable
fun OnboardingCard(content: @Composable ColumnScope.() -> Unit) {
    val boxed = androidx.compose.ui.platform.LocalConfiguration.current.screenWidthDp >= OnboardingCardMinWidthDp
    if (boxed) {
        Column(
            modifier = Modifier
                .widthIn(max = 460.dp)
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .clip(OnboardingCardShape)
                .background(com.movviz.nx.mobile.ui.theme.MovvizSurfaceStrong.copy(alpha = 0.92f))
                .border(1.dp, Color.White.copy(alpha = 0.09f), OnboardingCardShape)
                .padding(horizontal = 22.dp, vertical = 26.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            content = content,
        )
    } else {
        Column(
            modifier = Modifier
                .widthIn(max = 460.dp)
                .fillMaxWidth()
                .padding(horizontal = 24.dp, vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            content = content,
        )
    }
}

/** Grand CTA dégradé violet avec chevron "›". */
@Composable
fun OnboardingPrimaryButton(
    text: String,
    enabled: Boolean = true,
    focusRequester: FocusRequester? = null,
    onClick: () -> Unit,
) {
    var focused by remember { mutableStateOf(false) }
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(OnboardingCtaShape)
            .background(Brush.horizontalGradient(com.movviz.nx.mobile.ui.theme.MovvizBrandGradientColors), OnboardingCtaShape)
            .border(
                if (focused) 2.dp else 0.dp,
                Color.White.copy(alpha = if (focused) 0.9f else 0f),
                OnboardingCtaShape,
            )
            .onFocusChanged { focused = it.isFocused }
            .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
            .hapticClickable(enabled = enabled, onClick = onClick)
            .tvPointerClick(onClick)
            .padding(vertical = 17.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = if (text.endsWith("›")) text else "$text   ›",
            style = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color.White),
        )
    }
}

/** Séparateur "— ou —" : deux filets autour du libellé. */
@Composable
fun OnboardingOrDivider(label: String = "ou") {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.weight(1f).height(1.dp).background(Color.White.copy(alpha = 0.12f)))
        Text(
            text = label,
            style = TextStyle(fontSize = 13.sp, color = Color.White.copy(alpha = 0.55f)),
            modifier = Modifier.padding(horizontal = 14.dp),
        )
        Box(Modifier.weight(1f).height(1.dp).background(Color.White.copy(alpha = 0.12f)))
    }
}

@Composable
fun OnboardingError(message: String?) {
    if (message != null) {
        Spacer(Modifier.height(12.dp))
        Text(
            text = message,
            style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFFFF5B78), textAlign = TextAlign.Center),
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
fun OnboardingFootnote(text: String) {
    Spacer(Modifier.height(14.dp))
    Text(
        text = text,
        style = TextStyle(fontSize = 13.sp, color = MovvizInkDim, textAlign = TextAlign.Center),
        modifier = Modifier.fillMaxWidth(),
    )
}
