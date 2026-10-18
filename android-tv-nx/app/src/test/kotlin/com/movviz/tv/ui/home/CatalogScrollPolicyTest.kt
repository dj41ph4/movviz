package com.movviz.tv.ui.home

import com.movviz.tv.ui.discover.isUserFocusMove
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CatalogScrollPolicyTest {
    private val recent = catalogFilterSignature(CatalogSort.RECENT, null, false)

    @Test fun firstCompositionNeverResets() {
        assertFalse(shouldResetCatalogScroll(applied = null, current = recent))
    }

    @Test fun returningWithSameFiltersKeepsScroll() {
        // Retour de fiche / d'onglet : l'effet se relance avec la même signature.
        assertFalse(shouldResetCatalogScroll(applied = recent, current = catalogFilterSignature(CatalogSort.RECENT, null, false)))
    }

    @Test fun realSortGenreOrMissingChangeResets() {
        assertTrue(shouldResetCatalogScroll(recent, catalogFilterSignature(CatalogSort.NAME, null, false)))
        assertTrue(shouldResetCatalogScroll(recent, catalogFilterSignature(CatalogSort.RECENT, "28", false)))
        assertTrue(shouldResetCatalogScroll(recent, catalogFilterSignature(CatalogSort.RECENT, null, true)))
    }

    @Test fun signatureDistinguishesEveryFilter() {
        val signatures = setOf(
            catalogFilterSignature(CatalogSort.RECENT, null, false),
            catalogFilterSignature(CatalogSort.YEAR, null, false),
            catalogFilterSignature(CatalogSort.RECENT, "anime", false),
            catalogFilterSignature(CatalogSort.RECENT, "teen", false),
            catalogFilterSignature(CatalogSort.RECENT, null, true),
        )
        assertEquals(5, signatures.size)
        assertNotEquals(catalogFilterSignature(CatalogSort.RECENT, "", false), catalogFilterSignature(CatalogSort.RECENT, "x", false))
    }

    @Test fun focusLossRightAfterKeyIsUserMove() {
        assertTrue(isUserFocusMove(lastKeyAtMs = 10_000L, nowMs = 10_200L))
        // Contenu remplacé longtemps après la dernière touche : pas un départ.
        assertFalse(isUserFocusMove(lastKeyAtMs = 10_000L, nowMs = 11_000L))
        // Aucune touche encore pressée sur l'écran.
        assertFalse(isUserFocusMove(lastKeyAtMs = 0L, nowMs = 200L))
    }
}
