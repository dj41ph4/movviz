package com.movviz.tv.ui.theme

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MovvizMotionTest {
    private val eps = 1e-4f

    @Test fun reducedMotionWhenEitherSystemScaleIsZero() {
        assertTrue(isReducedMotion(animatorScale = 0f, transitionScale = 1f))
        assertTrue(isReducedMotion(animatorScale = 1f, transitionScale = 0f))
        assertFalse(isReducedMotion(animatorScale = 1f, transitionScale = 1f))
        assertFalse(isReducedMotion(animatorScale = 0.5f, transitionScale = 2f))
    }

    @Test fun easeOutCurveMatchesSpecEndpoints() {
        assertEquals(0f, MovvizMotion.EaseOut.transform(0f), eps)
        assertEquals(1f, MovvizMotion.EaseOut.transform(1f), eps)
        // Sortie forte : déjà bien avancée à mi-course.
        assertTrue(MovvizMotion.EaseOut.transform(0.5f) > 0.85f)
    }

    @Test fun logoSlitStartsAt48PercentAndOpensFullyAt75Percent() {
        val t = ProjectionSplashTimeline
        assertEquals(0.48f, t.logoClipInset(0f), eps)
        assertEquals(0f, t.logoClipInset(t.LOGO_MS * 0.75f), eps)
        assertEquals(0f, t.logoClipInset(t.END_MS), eps)
    }

    @Test fun logoScalesFrom078To1() {
        val t = ProjectionSplashTimeline
        assertEquals(0.78f, t.logoScale(0f), eps)
        assertEquals(1f, t.logoScale(t.LOGO_MS * 0.75f), eps)
        assertEquals(1f, t.logoAlpha(t.LOGO_MS * 0.22f), eps)
        assertEquals(0f, t.logoAlpha(0f), eps)
    }

    @Test fun shuttersHoldDuringFirst12PercentThenOpen() {
        val t = ProjectionSplashTimeline
        assertEquals(0f, t.shutterOpen(0f), eps)
        assertEquals(0f, t.shutterOpen(t.SHUTTER_MS * 0.12f), eps)
        assertTrue(t.shutterOpen(t.SHUTTER_MS * 0.5f) in 0.01f..0.99f)
        assertEquals(1f, t.shutterOpen(t.SHUTTER_MS), eps)
    }

    @Test fun projectorIgnitesBy35PercentAndSettlesAtFullScale() {
        val t = ProjectionSplashTimeline
        assertEquals(0.5f, t.projectorScale(0f), eps)
        assertEquals(0.85f, t.projectorScale(t.PROJECTOR_MS * 0.35f), eps)
        assertEquals(1f, t.projectorScale(t.PROJECTOR_MS), eps)
        assertEquals(1f, t.projectorAlpha(t.PROJECTOR_MS * 0.35f), eps)
    }

    @Test fun orbitsEnterFromWideAngleAndRestAtTilt() {
        val t = ProjectionSplashTimeline
        assertEquals(115f, t.orbitRotation(0f, clockwise = false), eps)
        assertEquals(-28f, t.orbitRotation(1f, clockwise = false), eps)
        assertEquals(-115f, t.orbitRotation(0f, clockwise = true), eps)
        assertEquals(28f, t.orbitRotation(1f, clockwise = true), eps)
        assertEquals(0.7f, t.orbitScale(0f), eps)
        assertEquals(1f, t.orbitEntry(t.ORBIT_B_MS, t.ORBIT_B_MS), eps)
    }

    @Test fun textFadesInAfterItsDelay() {
        val t = ProjectionSplashTimeline
        assertEquals(0f, t.textAlpha(t.HEADLINE_DELAY_MS, t.HEADLINE_DELAY_MS), eps)
        assertEquals(1f, t.textAlpha(t.HEADLINE_DELAY_MS + t.TEXT_MS, t.HEADLINE_DELAY_MS), eps)
    }

    @Test fun exitZoomsTo106() {
        assertEquals(1f, ProjectionSplashTimeline.exitScale(0f), eps)
        assertEquals(1.06f, ProjectionSplashTimeline.exitScale(1f), eps)
        assertEquals(1.06f, ProjectionSplashTimeline.exitScale(2f), eps)
    }

    @Test fun progressFractionIsClampedAndNullIsEmpty() {
        assertEquals(0f, ProjectionSplashTimeline.progressFraction(null), eps)
        assertEquals(0.42f, ProjectionSplashTimeline.progressFraction(42), eps)
        assertEquals(1f, ProjectionSplashTimeline.progressFraction(140), eps)
        assertEquals(0f, ProjectionSplashTimeline.progressFraction(-3), eps)
    }
}
