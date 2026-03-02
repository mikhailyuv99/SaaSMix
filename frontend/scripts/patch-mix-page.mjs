import fs from "fs";
import path from "path";

const pagePath = path.join(process.cwd(), "app", "mix", "page.tsx");
let content = fs.readFileSync(pagePath, "utf8");
const lines = content.split("\n");

const startMark = "  function RenderMixContent() {";
const endMark = "  return React.createElement(RenderMixContent, null);";

const startIdx = lines.findIndex((l) => l.trimStart().startsWith("function RenderMixContent()"));
const endIdx = lines.findIndex((l) => l.includes("return React.createElement(RenderMixContent, null)"));

if (startIdx === -1 || endIdx === -1) {
  console.error("Could not find block", { startIdx, endIdx });
  process.exit(1);
}

const assignVars = [
  "appModal", "setAppModal", "promptInputValue", "setPromptInputValue", "tracks", "setTracks",
  "isPlaying", "setIsPlaying", "hasPausedPosition", "setHasPausedPosition", "playbackPosition", "setPlaybackPosition",
  "pausedAtSeconds", "setPausedAtSeconds", "isRenderingMix", "setIsRenderingMix", "isMastering", "setIsMastering",
  "masterResult", "setMasterResult", "masterPlaybackMode", "setMasterPlaybackMode", "masterWaveforms", "setMasterWaveforms",
  "masterPlaybackCurrentTime", "setMasterPlaybackCurrentTime", "isMasterResultPlaying", "setIsMasterResultPlaying",
  "activePlayer", "setActivePlayer", "masterResumeFrom", "setMasterResumeFrom", "gainSliderHoveredTrackId", "setGainSliderHoveredTrackId",
  "focusedCategoryTrackId", "setFocusedCategoryTrackId", "fileChooserActiveTrackId", "setFileChooserActiveTrackId",
  "noFileMessageTrackId", "setNoFileMessageTrackId", "showPlayNoFileMessage", "setShowPlayNoFileMessage",
  "projectBpm", "setProjectBpm", "bpmInput", "setBpmInput", "bpmInputFocused", "setBpmInputFocused",
  "mixedPreloadReady", "setMixedPreloadReady", "isDownloadingMaster", "setIsDownloadingMaster",
  "user", "setUser", "logout", "openAuthModal", "hasUnsavedChanges", "setHasUnsavedChanges",
  "showLeaveModal", "setShowLeaveModal", "setLeaveIntent", "setLeaveConfirmAction", "isPro", "setIsPro",
  "setOpenManageSubscription", "subscriptionModalOpen", "setSubscriptionModalOpen", "checkoutPriceId", "setCheckoutPriceId",
  "checkoutLabel", "setCheckoutLabel", "manageSubscriptionModalOpen", "setManageSubscriptionModalOpen",
  "openManageWithChangePlanView", "setOpenManageWithChangePlanView", "isSavingProject", "setIsSavingProject",
  "isCreatingProject", "setIsCreatingProject", "projectsList", "setProjectsList", "showProjectsModal", "setShowProjectsModal",
  "loadingProjectId", "setLoadingProjectId", "currentProject", "setCurrentProject", "mixProgress", "setMixProgress",
  "categoryModal", "setCategoryModal", "mixDropzoneDragging", "setMixDropzoneDragging", "addTrackDropzoneDragging", "setAddTrackDropzoneDragging",
  "isMixFullscreen", "setIsMixFullscreen", "mixSectionRef", "bpmBoxRef", "masterResultSectionRef", "demoPlaybackRef",
  "trackPlaybackRef", "masterPlaybackRef", "contextRef", "showSubscriptionRequired", "removeTrack", "updateTrack", "addTrack",
  "playAll", "stopAll", "downloadMix", "runMaster", "toggleMixFullscreen", "seekMaster", "startMasterPlayback", "stopMasterPlayback",
  "applyGainToNodes", "startPlaybackAtOffset", "currentTimeForWaveform", "silentWavUrl", "hasAnyPlayable",
  "applyCategoryChoice", "loadProject", "openRenameProjectPrompt", "deleteProject", "createNewProject", "saveProject",
  "fetchProjectsList", "getAuthHeaders", "fetchBilling", "heroLoadFailed", "mixProgressTargetRef",
  "Waveform", "CATEGORY_LABELS", "TONE_OPTIONS", "GATE_MODE_OPTIONS", "isVocal", "formatApiError", "getDefaultTracks",
  "mixDropzoneInputRef", "addTrackDropzoneInputRef",
];

const assignBlock = [
  "  const vm = mixPageViewModelRef.current;",
  ...assignVars.filter((v) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v)).map((v) => `  vm.${v} = ${v};`),
  "  return React.createElement(MixPageViewModelContext.Provider, { value: mixPageViewModelRef.current }, React.createElement(MixPageView, null));",
].join("\n");

const before = lines.slice(0, startIdx).join("\n");
const after = lines.slice(endIdx + 1).join("\n");
const newContent = before + "\n" + assignBlock + "\n" + after;

fs.writeFileSync(pagePath, newContent, "utf8");
console.log("Patched page.tsx");
