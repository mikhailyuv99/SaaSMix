import fs from "fs";
import path from "path";

const pagePath = path.join(process.cwd(), "app", "mix", "page.tsx");
const content = fs.readFileSync(pagePath, "utf8");
const lines = content.split("\n");

// Find JSX block: from "      <main" to "      </main>"
let startIdx = -1;
let endIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("<main className=\"relative z-10")) {
    startIdx = i;
    break;
  }
}
for (let i = (startIdx || 0); i < lines.length; i++) {
  if (lines[i].trim() === "</main>") {
    endIdx = i;
    break;
  }
}
if (startIdx === -1 || endIdx === -1) {
  console.error("Could not find <main>...</main> block");
  process.exit(1);
}

let jsx = lines.slice(startIdx, endIdx + 1).join("\n");

// Variables to replace (longer first to avoid setAppModal -> setvm.appModal)
const vars = [
  "setShowLeaveModal", "setShowProjectsModal", "setShowPlayNoFileMessage", "setShowSubscriptionRequired",
  "setProjectBpm", "setPromptInputValue", "setOpenManageSubscription", "setNoFileMessageTrackId",
  "setMasterResumeFrom", "setMasterPlaybackCurrentTime", "setMixDropzoneDragging", "setMixProgress",
  "setManageSubscriptionModalOpen", "setLeaveConfirmAction", "setLeaveIntent", "setIsMixFullscreen",
  "setIsDownloadingMaster", "setGainSliderHoveredTrackId", "setFocusedCategoryTrackId",
  "setFileChooserActiveTrackId", "setCurrentProject", "setCheckoutPriceId", "setCheckoutLabel",
  "setCategoryModal", "setBpmInputFocused", "setBpmInput", "setAddTrackDropzoneDragging",
  "openManageWithChangePlanView", "manageSubscriptionModalOpen", "isMixFullscreen", "heroLoadFailed",
  "showSubscriptionRequired", "showProjectsModal", "showPlayNoFileMessage", "showLeaveModal",
  "masterPlaybackCurrentTime", "masterPlaybackMode", "loadingProjectId", "hasUnsavedChanges",
  "gainSliderHoveredTrackId", "focusedCategoryTrackId", "fileChooserActiveTrackId", "createTrackFromFile",
  "applyCategoryChoice", "addTrackDropzoneDragging", "toggleMasterPlaybackMode", "startMasterPlayback",
  "stopMasterPlayback", "setMasterResult", "setMasterPlaybackMode", "setMasterWaveforms",
  "setMasterResumeFrom", "setMasterPlaybackCurrentTime", "setIsMasterResultPlaying",
  "setActivePlayer", "setAppModal", "setTracks", "setIsPlaying", "setHasPausedPosition",
  "setPlaybackPosition", "setPausedAtSeconds", "setIsRenderingMix", "setIsMastering",
  "setMasterResult", "setMasterWaveforms", "setMasterPlaybackCurrentTime", "setIsMasterResultPlaying",
  "setGainSliderHoveredTrackId", "setFocusedCategoryTrackId", "setFileChooserActiveTrackId",
  "setNoFileMessageTrackId", "setProjectBpm", "setBpmInput", "setBpmInputFocused", "setMixedPreloadReady",
  "setIsDownloadingMaster", "setUser", "setHasUnsavedChanges", "setShowLeaveModal", "setLeaveIntent",
  "setLeaveConfirmAction", "setIsPro", "setOpenManageSubscription", "setSubscriptionModalOpen",
  "setCheckoutPriceId", "setCheckoutLabel", "setManageSubscriptionModalOpen", "setOpenManageWithChangePlanView",
  "setIsSavingProject", "setIsCreatingProject", "setProjectsList", "setShowProjectsModal",
  "setLoadingProjectId", "setCurrentProject", "setMixProgress", "setCategoryModal", "setMixDropzoneDragging",
  "setAddTrackDropzoneDragging", "setIsMixFullscreen",
  "openRenameProjectPrompt", "deleteProject", "loadProject", "createNewProject", "saveProject",
  "fetchProjectsList", "doCreateNewProject", "doCreateNewProjectWithCurrentTracks", "doSaveProject",
  "getAuthHeaders", "fetchBilling", "applyFileWithCategory", "removeTrack", "updateTrack", "addTrack",
  "playAll", "stopAll", "downloadMix", "runMaster", "toggleMixFullscreen", "seekMaster",
  "startMasterPlayback", "stopMasterPlayback", "applyGainToNodes", "startPlaybackAtOffset",
  "mixDropzoneInputRef", "addTrackDropzoneInputRef", "mixSectionRef", "bpmBoxRef", "masterResultSectionRef",
  "demoPlaybackRef", "trackPlaybackRef", "masterPlaybackRef", "contextRef",
  "currentTimeForWaveform", "silentWavUrl", "hasAnyPlayable", "mixProgress", "mixProgressTargetRef",
  "promptInputValue", "projectsList", "currentProject", "categoryModal", "masterResult", "masterWaveforms",
  "isMasterResultPlaying", "masterResumeFrom", "isRenderingMix", "isMastering", "isSavingProject",
  "isCreatingProject", "isDownloadingMaster", "isMixFullscreen", "bpmInputFocused", "bpmInput",
  "projectBpm", "appModal", "tracks", "isPlaying", "hasPausedPosition", "user", "openAuthModal",
  "isPro", "checkoutPriceId", "checkoutLabel", "subscriptionModalOpen", "manageSubscriptionModalOpen",
  "showProjectsModal", "loadingProjectId", "hasUnsavedChanges", "noFileMessageTrackId",
  "gainSliderHoveredTrackId", "focusedCategoryTrackId", "mixDropzoneDragging", "showPlayNoFileMessage",
  "activePlayer", "playbackPosition", "pausedAtSeconds", "Waveform", "CATEGORY_LABELS", "TONE_OPTIONS",
  "GATE_MODE_OPTIONS", "isVocal", "formatApiError", "getDefaultTracks", "MixPortalContext",
  "setBpmInputFocused", "setPromptInputValue", "setCategoryModal", "setTracks", "setIsPlaying",
  "setHasPausedPosition", "setPlaybackPosition", "setPausedAtSeconds", "setIsRenderingMix",
  "setIsMastering", "setMasterResult", "setMasterPlaybackMode", "setMasterWaveforms",
  "setMasterPlaybackCurrentTime", "setIsMasterResultPlaying", "setActivePlayer", "setMasterResumeFrom",
  "setGainSliderHoveredTrackId", "setFocusedCategoryTrackId", "setFileChooserActiveTrackId",
  "setNoFileMessageTrackId", "setShowPlayNoFileMessage", "setProjectBpm", "setBpmInput",
  "setBpmInputFocused", "setMixedPreloadReady", "setIsDownloadingMaster", "setUser",
  "setHasUnsavedChanges", "setShowLeaveModal", "setLeaveIntent", "setLeaveConfirmAction",
  "setIsPro", "setOpenManageSubscription", "setSubscriptionModalOpen", "setCheckoutPriceId",
  "setCheckoutLabel", "setManageSubscriptionModalOpen", "setOpenManageWithChangePlanView",
  "setIsSavingProject", "setIsCreatingProject", "setProjectsList", "setShowProjectsModal",
  "setLoadingProjectId", "setCurrentProject", "setMixProgress", "setCategoryModal",
  "setMixDropzoneDragging", "setAddTrackDropzoneDragging", "setIsMixFullscreen",
];

// Dedupe and sort by length descending
const unique = [...new Set(vars)].sort((a, b) => b.length - a.length);

for (const v of unique) {
  const re = new RegExp("\\b" + v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "g");
  jsx = jsx.replace(re, "vm." + v);
}

const out = `"use client";

import { useContext } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CustomSelect } from "../components/CustomSelect";
import { PricingModal } from "../components/PricingModal";
import { ManageSubscriptionModal } from "../components/ManageSubscriptionModal";
import {
  TrustBullets,
  HowItWorks,
  VideoSection,
  BeforeAfterSection,
  FeaturesSection,
  PricingSection,
  FAQContactSection,
} from "../components/landing";
import { MixPageViewModelContext } from "./MixPageViewModelContext";
import { MixPortalContext } from "../context/MixPortalContext";

export function MixPageView() {
  const vm = useContext(MixPageViewModelContext);
  if (!vm) return null;
  return (
${jsx}
  );
}
`;

const outPath = path.join(process.cwd(), "app", "mix", "MixPageView.tsx");
fs.writeFileSync(outPath, out, "utf8");
console.log("Wrote", outPath);
