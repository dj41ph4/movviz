package com.movviz.nx.mobile.ui.ai

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import coil.compose.rememberAsyncImagePainter
import com.movviz.nx.mobile.AppViewModel
import com.movviz.nx.mobile.data.AiChatMessageDto
import com.movviz.nx.mobile.data.AiRecommendationDto
import com.movviz.nx.mobile.ui.theme.MovvizBackground
import com.movviz.nx.mobile.ui.theme.MovvizBrand
import com.movviz.nx.mobile.ui.theme.MovvizBrand2
import com.movviz.nx.mobile.ui.theme.MovvizBrandGlow
import com.movviz.nx.mobile.ui.theme.MovvizIconCheck
import com.movviz.nx.mobile.ui.theme.MovvizIconClose
import com.movviz.nx.mobile.ui.theme.MovvizIconEye
import com.movviz.nx.mobile.ui.theme.MovvizIconFilm
import com.movviz.nx.mobile.ui.theme.MovvizIconPlus
import com.movviz.nx.mobile.ui.theme.MovvizIconSend
import com.movviz.nx.mobile.ui.theme.MovvizIconSparkle
import com.movviz.nx.mobile.ui.theme.MovvizIconThumbDown
import com.movviz.nx.mobile.ui.theme.MovvizIconThumbUp
import com.movviz.nx.mobile.ui.theme.MovvizIconTrash
import com.movviz.nx.mobile.ui.theme.MovvizInk
import com.movviz.nx.mobile.ui.theme.MovvizInkDim
import com.movviz.nx.mobile.ui.theme.MovvizInkSoft
import com.movviz.nx.mobile.ui.theme.MovvizLine
import com.movviz.nx.mobile.ui.theme.MovvizOk
import com.movviz.nx.mobile.ui.theme.MovvizSurface
import com.movviz.nx.mobile.ui.theme.MovvizSurfaceStrong

private const val POSTER_BASE = "https://image.tmdb.org/t/p/w185"
private val STARTERS = listOf("Tu peux faire quoi pour moi ?", "Conseille-moi un film", "Une série pour ce soir")

/**
 * Assistant IA sur mobile — même conversation que le desktop (la session est
 * côté serveur, par profil) : bulle flottante au-dessus du contenu, puis chat
 * plein écran. Identique sur les trois géométries (portrait, paysage,
 * déplié) : seule la largeur de lecture est bornée au-delà du téléphone, et
 * la bulle remonte au-dessus de la barre basse quand elle existe.
 */
@Composable
fun AiChatLauncher(
    viewModel: AppViewModel,
    showButton: Boolean,
    buttonBottomPadding: Dp,
    onOpenTitle: (type: String, tmdbId: Int) -> Unit,
) {
    val enabled by viewModel.aiEnabled.collectAsState()
    var open by rememberSaveable { mutableStateOf(false) }
    // Relu à chaque changement de compte/profil : la conversation est par profil.
    val user by viewModel.currentUser.collectAsState()
    val profile by viewModel.activeProfile.collectAsState()
    LaunchedEffect(user?.username, profile) { viewModel.refreshAiSession() }
    if (!enabled) return

    if (open) {
        AiChatScreen(
            viewModel = viewModel,
            onClose = { open = false },
            onOpenTitle = { type, tmdbId ->
                open = false
                onOpenTitle(type, tmdbId)
            },
        )
    } else if (showButton) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.BottomEnd) {
            Box(
                modifier = Modifier
                    .navigationBarsPadding()
                    .padding(end = 16.dp, bottom = buttonBottomPadding)
                    .size(56.dp)
                    .shadow(12.dp, CircleShape, clip = false)
                    .background(Brush.linearGradient(listOf(MovvizBrand, MovvizBrand2)), CircleShape)
                    .clip(CircleShape)
                    .clickable { open = true; viewModel.refreshAiSession() },
                contentAlignment = Alignment.Center,
            ) {
                Icon(MovvizIconSparkle, contentDescription = "Assistant Movviz", tint = Color.White, modifier = Modifier.size(26.dp))
            }
        }
    }
}

@Composable
private fun AiChatScreen(
    viewModel: AppViewModel,
    onClose: () -> Unit,
    onOpenTitle: (type: String, tmdbId: Int) -> Unit,
) {
    val messages by viewModel.aiMessages.collectAsState()
    val busy by viewModel.aiBusy.collectAsState()
    val swapping by viewModel.aiSwapping.collectAsState()
    var input by rememberSaveable { mutableStateOf("") }
    // 👍 posés dans cette ouverture — affichage seulement, la vraie trace est côté serveur.
    val liked = remember { mutableStateMapOf<String, Boolean>() }
    val listState = rememberLazyListState()
    BackHandler(onBack = onClose)

    val send: (String) -> Unit = { text ->
        if (text.isNotBlank() && !busy) {
            viewModel.sendAiMessage(text)
            input = ""
        }
    }
    LaunchedEffect(messages.size, busy) {
        val last = messages.size + (if (busy) 1 else 0) - 1
        if (last >= 0) listState.animateScrollToItem(last)
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MovvizBackground)
            // Le chat capte tous les appuis : rien ne traverse vers l'écran dessous.
            .pointerInput(Unit) { detectTapGestures { } },
        contentAlignment = Alignment.TopCenter,
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .widthIn(max = 720.dp)
                .statusBarsPadding()
                .navigationBarsPadding()
                .imePadding(),
        ) {
            // En-tête
            Row(
                modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 8.dp, top = 12.dp, bottom = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    Modifier.size(36.dp).background(MovvizBrand.copy(alpha = .18f), RoundedCornerShape(12.dp)),
                    contentAlignment = Alignment.Center,
                ) { Icon(MovvizIconSparkle, contentDescription = null, tint = MovvizBrandGlow, modifier = Modifier.size(20.dp)) }
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text("Movviz AI", color = MovvizInk, fontSize = 17.sp, fontWeight = FontWeight.Black)
                    Text("Conseils selon tout ce que tu as vu", color = MovvizInkSoft, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                HeaderButton(MovvizIconTrash, "Effacer la conversation") { viewModel.clearAiSession() }
                HeaderButton(MovvizIconClose, "Fermer", onClose)
            }
            Box(Modifier.fillMaxWidth().height(1.dp).background(MovvizLine))

            LazyColumn(
                state = listState,
                modifier = Modifier.weight(1f).fillMaxWidth(),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp, vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (messages.isEmpty() && !busy) {
                    item {
                        Column(Modifier.fillMaxWidth().padding(top = 48.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(MovvizIconSparkle, contentDescription = null, tint = MovvizBrandGlow, modifier = Modifier.size(32.dp))
                            Spacer(Modifier.height(10.dp))
                            Text("Demande-moi un conseil, ou ce que je peux faire pour toi.", color = MovvizInkSoft, fontSize = 14.sp)
                            Spacer(Modifier.height(16.dp))
                            QuickReplies(STARTERS, onPick = send)
                        }
                    }
                }
                items(messages.size) { index ->
                    val message = messages[index]
                    if (message.role == "user") {
                        UserBubble(message.content)
                    } else {
                        AssistantBubble(
                            message = message,
                            isLast = index == messages.lastIndex,
                            busy = busy,
                            swapping = swapping,
                            liked = liked,
                            onOpenTitle = onOpenTitle,
                            onAdd = viewModel::aiAddCard,
                            onLike = { card -> liked["${card.type}:${card.tmdbId}"] = true; viewModel.aiLike(card) },
                            onSwap = viewModel::aiCardAction,
                            onPick = send,
                        )
                    }
                }
                if (busy) {
                    item {
                        Box(
                            Modifier.background(MovvizSurfaceStrong, RoundedCornerShape(18.dp, 18.dp, 18.dp, 6.dp)).padding(horizontal = 14.dp, vertical = 10.dp),
                        ) { Text("Je réfléchis…", color = MovvizInkSoft, fontSize = 14.sp) }
                    }
                }
            }

            // Saisie
            Row(
                modifier = Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, top = 8.dp, bottom = 12.dp),
                verticalAlignment = Alignment.Bottom,
            ) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .heightIn(min = 48.dp)
                        .border(1.dp, MovvizInk.copy(alpha = .18f), RoundedCornerShape(24.dp))
                        .background(MovvizSurface, RoundedCornerShape(24.dp))
                        .padding(horizontal = 18.dp, vertical = 13.dp),
                    contentAlignment = Alignment.CenterStart,
                ) {
                    if (input.isEmpty()) Text("Écris ton message…", color = MovvizInkDim, fontSize = 15.sp)
                    BasicTextField(
                        value = input,
                        onValueChange = { input = it },
                        maxLines = 4,
                        textStyle = TextStyle(fontSize = 15.sp, color = MovvizInk),
                        cursorBrush = SolidColor(MovvizBrandGlow),
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                Spacer(Modifier.width(8.dp))
                val canSend = input.isNotBlank() && !busy
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .alpha(if (canSend) 1f else .4f)
                        .background(Brush.linearGradient(listOf(MovvizBrand, MovvizBrand2)), CircleShape)
                        .clip(CircleShape)
                        .clickable(enabled = canSend) { send(input) },
                    contentAlignment = Alignment.Center,
                ) { Icon(MovvizIconSend, contentDescription = "Envoyer", tint = Color.White, modifier = Modifier.size(22.dp)) }
            }
        }
    }
}

@Composable
private fun HeaderButton(icon: ImageVector, label: String, onClick: () -> Unit) {
    Box(
        Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)).clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { Icon(icon, contentDescription = label, tint = MovvizInkSoft, modifier = Modifier.size(20.dp)) }
}

@Composable
private fun UserBubble(text: String) {
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterEnd) {
        Box(
            Modifier
                .widthIn(max = 300.dp)
                .background(MovvizBrand, RoundedCornerShape(18.dp, 18.dp, 6.dp, 18.dp))
                .padding(horizontal = 14.dp, vertical = 10.dp),
        ) { Text(text, color = Color.White, fontSize = 15.sp) }
    }
}

@Composable
private fun AssistantBubble(
    message: AiChatMessageDto,
    isLast: Boolean,
    busy: Boolean,
    swapping: String?,
    liked: Map<String, Boolean>,
    onOpenTitle: (String, Int) -> Unit,
    onAdd: (AiRecommendationDto) -> Unit,
    onLike: (AiRecommendationDto) -> Unit,
    onSwap: (AiRecommendationDto, String) -> Unit,
    onPick: (String) -> Unit,
) {
    Column(Modifier.fillMaxWidth()) {
        if (message.content.isNotBlank()) {
            Box(
                Modifier
                    .widthIn(max = 340.dp)
                    .background(MovvizSurfaceStrong, RoundedCornerShape(18.dp, 18.dp, 18.dp, 6.dp))
                    .padding(horizontal = 14.dp, vertical = 10.dp),
            ) { Text(message.content, color = MovvizInk, fontSize = 15.sp, lineHeight = 21.sp) }
        }
        message.actions?.takeIf { it.isNotEmpty() }?.let { actions ->
            Spacer(Modifier.height(6.dp))
            actions.forEach { outcome ->
                Text(
                    "${outcome.title}${outcome.year?.let { " ($it)" } ?: ""}",
                    color = MovvizInkSoft,
                    fontSize = 12.sp,
                    modifier = Modifier.padding(start = 4.dp, top = 2.dp),
                )
            }
        }
        message.recommendations?.takeIf { it.isNotEmpty() }?.let { cards ->
            Spacer(Modifier.height(8.dp))
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                cards.forEach { card ->
                    val key = "${card.type}:${card.tmdbId}"
                    RecommendationCard(
                        card = card,
                        busy = swapping == key,
                        liked = liked[key] == true,
                        onOpen = { onOpenTitle(card.type, card.tmdbId) },
                        onAdd = { onAdd(card) },
                        onLike = { onLike(card) },
                        onSeen = { onSwap(card, "seen") },
                        onDislike = { onSwap(card, "dislike") },
                    )
                }
            }
        }
        if (isLast && !busy) {
            message.suggestions?.takeIf { it.isNotEmpty() }?.let {
                Spacer(Modifier.height(10.dp))
                QuickReplies(it, onPick = onPick)
            }
        }
    }
}

@Composable
private fun RecommendationCard(
    card: AiRecommendationDto,
    busy: Boolean,
    liked: Boolean,
    onOpen: () -> Unit,
    onAdd: () -> Unit,
    onLike: () -> Unit,
    onSeen: () -> Unit,
    onDislike: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .alpha(if (busy) .4f else 1f)
            .background(MovvizSurface, RoundedCornerShape(14.dp))
            .border(1.dp, MovvizInk.copy(alpha = .08f), RoundedCornerShape(14.dp))
            .padding(10.dp),
    ) {
        Box(
            Modifier.width(56.dp).height(84.dp).clip(RoundedCornerShape(8.dp)).background(MovvizSurfaceStrong).clickable(onClick = onOpen),
            contentAlignment = Alignment.Center,
        ) {
            if (card.posterPath != null) {
                Image(
                    painter = rememberAsyncImagePainter("$POSTER_BASE${card.posterPath}", contentScale = ContentScale.Crop),
                    contentDescription = card.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                Icon(MovvizIconFilm, contentDescription = null, tint = MovvizInkDim, modifier = Modifier.size(22.dp))
            }
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                card.title,
                color = MovvizInk,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.clickable(onClick = onOpen),
            )
            val meta = listOfNotNull(
                card.year?.toString(),
                if (card.type == "series") "Série" else "Film",
                card.rating.takeIf { it > 0 }?.let { String.format(java.util.Locale.FRANCE, "%.1f", it) },
            ).joinToString(" · ")
            Text(meta, color = MovvizInkSoft, fontSize = 12.sp)
            card.reason?.takeIf { it.isNotBlank() }?.let {
                Spacer(Modifier.height(4.dp))
                Text(it, color = MovvizInkSoft, fontSize = 12.sp, fontStyle = FontStyle.Italic, lineHeight = 16.sp, maxLines = 3, overflow = TextOverflow.Ellipsis)
            }
            Spacer(Modifier.height(8.dp))
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (card.inLibrary) {
                    CardChip(MovvizIconCheck, "Dans la bibliothèque", tint = MovvizOk, background = MovvizOk.copy(alpha = .12f), onClick = onOpen)
                } else {
                    CardChip(MovvizIconPlus, "Ajouter", tint = Color.White, background = MovvizBrand, onClick = onAdd)
                }
                CardChip(MovvizIconEye, "Déjà vu", tint = MovvizInkSoft, background = Color.White.copy(alpha = .06f), onClick = onSeen)
                CardIcon(MovvizIconThumbUp, "J'aime", tint = if (liked) MovvizOk else MovvizInkDim, onClick = onLike)
                CardIcon(MovvizIconThumbDown, "Pas pour moi", tint = MovvizInkDim, onClick = onDislike)
            }
        }
    }
}

@Composable
private fun CardChip(icon: ImageVector, label: String, tint: Color, background: Color, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .height(36.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(background)
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(15.dp))
        Spacer(Modifier.width(5.dp))
        Text(label, color = tint, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1)
    }
}

@Composable
private fun CardIcon(icon: ImageVector, label: String, tint: Color, onClick: () -> Unit) {
    Box(
        Modifier.size(36.dp).clip(RoundedCornerShape(10.dp)).clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { Icon(icon, contentDescription = label, tint = tint, modifier = Modifier.size(17.dp)) }
}

@Composable
private fun QuickReplies(options: List<String>, onPick: (String) -> Unit) {
    Row(
        modifier = Modifier.horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        options.forEach { option ->
            Box(
                Modifier
                    .height(36.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .background(MovvizBrandGlow.copy(alpha = .14f))
                    .border(1.dp, MovvizBrandGlow.copy(alpha = .35f), RoundedCornerShape(18.dp))
                    .clickable { onPick(option) }
                    .padding(horizontal = 14.dp),
                contentAlignment = Alignment.Center,
            ) { Text(option, color = MovvizBrandGlow, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1) }
        }
    }
}
