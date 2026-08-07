import { VerticalSlicePresenter } from './vertical-slice-presenter.mjs';

const originalRenderCampaign = VerticalSlicePresenter.prototype.renderCampaign;

if (typeof originalRenderCampaign === 'function' && !VerticalSlicePresenter.prototype.__rareRouteUiFinalInstalled) {
  Object.defineProperty(VerticalSlicePresenter.prototype, '__rareRouteUiFinalInstalled', { value:true });
  VerticalSlicePresenter.prototype.renderCampaign = function renderCampaignWithActiveRareRoute(snapshot) {
    const rareRoute = snapshot?.campaign?.rareRoute;
    const rare = (snapshot?.campaign?.routes || []).find((route) => route.rare);
    if (rareRoute?.status !== 'open' || !rare) return originalRenderCampaign.call(this, snapshot);

    this.selectedCampaignNodeId = rare.to;
    const uiSnapshot = Object.freeze({
      ...snapshot,
      campaign:Object.freeze({
        ...snapshot.campaign,
        reopenableNodeIds:Object.freeze([])
      })
    });
    return originalRenderCampaign.call(this, uiSnapshot);
  };
}
