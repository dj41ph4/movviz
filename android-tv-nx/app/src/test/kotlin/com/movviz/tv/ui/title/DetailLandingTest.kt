package com.movviz.tv.ui.title

import org.junit.Assert.assertEquals
import org.junit.Test

class DetailLandingTest {
    @Test fun seasonFocusRedirectOnlyRunsForUnexpectedInitialFocus() {
        assertEquals(true, shouldRedirectSeasonCardFocus(false, false, false, false, 500L))
        assertEquals(false, shouldRedirectSeasonCardFocus(false, false, false, true, 500L))
        assertEquals(false, shouldRedirectSeasonCardFocus(false, true, false, false, 500L))
        assertEquals(false, shouldRedirectSeasonCardFocus(true, false, false, false, 500L))
        assertEquals(false, shouldRedirectSeasonCardFocus(false, false, true, false, 500L))
        assertEquals(false, shouldRedirectSeasonCardFocus(false, false, false, false, 2_000L))
    }

    @Test fun firstOpeningLandsOnPrimaryOrAnchor() {
        assertEquals(DetailLanding.PRIMARY_OR_ANCHOR, detailLanding(firstOpening = true, returnTarget = null, overlayOpen = false, userLeftDuringLoading = false))
    }

    @Test fun returnFromSimilarTitleRestoresSimilarRow() {
        assertEquals(DetailLanding.RESTORE_SIMILAR, detailLanding(firstOpening = false, returnTarget = DETAIL_RETURN_SIMILAR, overlayOpen = false, userLeftDuringLoading = false))
    }

    @Test fun returnFromPersonRestoresCastRow() {
        assertEquals(DetailLanding.RESTORE_CAST, detailLanding(firstOpening = false, returnTarget = DETAIL_RETURN_CAST, overlayOpen = false, userLeftDuringLoading = false))
    }

    @Test fun recreationWithoutReturnTargetNeverResetsToTop() {
        assertEquals(DetailLanding.NONE, detailLanding(firstOpening = false, returnTarget = null, overlayOpen = false, userLeftDuringLoading = false))
    }

    @Test fun overlayOwnsItsFocus() {
        assertEquals(DetailLanding.NONE, detailLanding(firstOpening = true, returnTarget = null, overlayOpen = true, userLeftDuringLoading = false))
        assertEquals(DetailLanding.NONE, detailLanding(firstOpening = false, returnTarget = DETAIL_RETURN_CAST, overlayOpen = true, userLeftDuringLoading = false))
    }

    @Test fun leavingToRailDuringLoadingIsRespected() {
        assertEquals(DetailLanding.NONE, detailLanding(firstOpening = true, returnTarget = null, overlayOpen = false, userLeftDuringLoading = true))
    }

    @Test fun unknownReturnTargetFallsBackToFirstOpeningRule() {
        assertEquals(DetailLanding.PRIMARY_OR_ANCHOR, detailLanding(firstOpening = true, returnTarget = "autre", overlayOpen = false, userLeftDuringLoading = false))
        assertEquals(DetailLanding.NONE, detailLanding(firstOpening = false, returnTarget = "autre", overlayOpen = false, userLeftDuringLoading = false))
    }
}
