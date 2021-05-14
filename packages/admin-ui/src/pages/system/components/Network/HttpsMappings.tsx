import React, { useState } from "react";
import { api, useApi } from "api";
import { useSelector } from "react-redux";
import { NavLink } from "react-router-dom";
import { getDappnodeIdentityClean } from "services/dappnodeStatus/selectors";
import { rootPath as installedRootPath } from "pages/installer";
import Alert from "react-bootstrap/esm/Alert";
import { BsArrowRight } from "react-icons/bs";
import { withToast } from "components/toast/Toast";
import { confirmPromise } from "components/ConfirmDialog";
import Switch from "components/Switch";
import ErrorView from "components/ErrorView";
import Ok from "components/Ok";
import { prettyFullName } from "utils/format";
import newTabProps from "utils/newTabProps";
import { ReqStatus, HttpsPortalMapping, ExposableServiceInfo } from "types";
import { httpsPortalDnpName } from "params";
import "./https-mapping.scss";
import { ExposableServiceMapping } from "common";
import Button from "components/Button";

export function HttpsMappings() {
  const [reqStatus, setReqStatus] = useState<ReqStatus>({});
  const mappings = useApi.httpsPortalExposableServicesGet();
  const dnpsRequest = useApi.packagesGet();
  const dappnodeIdentity = useSelector(getDappnodeIdentityClean);

  /** Refresh HTTPs Portal mapping */
  async function refreshMapping(httpsMapping: ExposableServiceMapping[]) {
    if (reqStatus.loading) return;

    try {
      await confirmPromise({
        title: "Refresh",
        text: "Refresh HTTPs portal mapping",
        label: "Refresh",
        variant: "dappnode"
      });

      setReqStatus({ loading: true });
      await withToast(
        () =>
          Promise.all(
            httpsMapping.map(httpsMapping =>
              api.httpsPortalMappingRemove(httpsMapping)
            )
          ),
        {
          message: "Removing HTTPs mapping...",
          onSuccess: "Removed HTTPs mapping"
        }
      );
      await withToast(
        () =>
          Promise.all(
            httpsMapping.map(httpsMapping =>
              api.httpsPortalMappingAdd(httpsMapping)
            )
          ),
        {
          message: "Adding HTTPs mapping...",
          onSuccess: "Added HTTPs mapping"
        }
      );
      setReqStatus({ result: true });
    } catch (e) {
      setReqStatus({ error: e.message });
    } finally {
      mappings.revalidate();
    }
  }

  /** Add the new mapping created in the local editor */
  async function addMapping(mappingInfo: ExposableServiceInfo) {
    if (reqStatus.loading) return;

    try {
      await confirmPromise({
        title: "Exposing service",
        text:
          "Are you sure you want to expose this service to the public internet?",
        label: "Expose",
        variant: "dappnode"
      });

      setReqStatus({ loading: true });
      await withToast(() => api.httpsPortalMappingAdd(mappingInfo), {
        message: "Adding HTTPs mapping...",
        onSuccess: "Added HTTPs mapping"
      });
      setReqStatus({ result: true });
    } catch (e) {
      setReqStatus({ error: e.message });
    } finally {
      mappings.revalidate();
    }
  }

  /** Remove any mapping, could be external to this service */
  async function removeMapping(mapping: HttpsPortalMapping) {
    if (reqStatus.loading) return;

    try {
      await confirmPromise({
        title: "Removing HTTPs mapping",
        text: "Are you sure you want to remove this HTTPs mapping?",
        label: "Remove",
        variant: "outline-danger"
      });

      setReqStatus({ loading: true });
      await withToast(() => api.httpsPortalMappingRemove(mapping), {
        message: "Removing HTTPs mapping...",
        onSuccess: "Removed HTTPs mapping"
      });
      setReqStatus({ result: true });
    } catch (e) {
      setReqStatus({ error: e.message });
    } finally {
      mappings.revalidate();
    }
  }

  // Helper UI in case the HTTPs Portal is bad
  if (dnpsRequest.data) {
    const httpsPortalDnp = dnpsRequest.data.find(
      dnp => dnp.dnpName === httpsPortalDnpName
    );
    if (!httpsPortalDnp) {
      const url = `${installedRootPath}/${httpsPortalDnpName}`;
      return (
        <Alert variant="secondary">
          You must <NavLink to={url}>install the HTTPs Portal</NavLink> to use
          this feature
        </Alert>
      );
    }
  }

  if (mappings.data) {
    return (
      <>
        <div className="list-grid system-network-mappings">
          {/* Table header */}
          <header>PACKAGE</header>
          <header>SERVICE</header>
          <header />
          <header>PUBLIC URL</header>
          <header>EXPOSE</header>

          <hr />

          {mappings.data.length === 0 && (
            <span className="no-mappings">No exposable services available</span>
          )}

          {mappings.data.map((mapping, i) => (
            <React.Fragment key={i}>
              <span className="package">
                <span>{prettyFullName(mapping)}</span>
              </span>
              <span className="service">
                <span className="title">{mapping.name}</span>
                <span className="help-text">{mapping.description}</span>
              </span>
              <span className="arrow">
                <BsArrowRight />
              </span>
              <span className="subdomain">
                {mapping.exposed ? (
                  <a
                    href={`https://${mapping.fromSubdomain}.${dappnodeIdentity.domain}`}
                    {...newTabProps}
                  >
                    {mapping.fromSubdomain}
                    <wbr />.{dappnodeIdentity.domain}
                  </a>
                ) : (
                  "-"
                )}
              </span>

              <Switch
                checked={mapping.exposed}
                onToggle={() =>
                  mapping.exposed ? removeMapping(mapping) : addMapping(mapping)
                }
              />
            </React.Fragment>
          ))}
        </div>
        <hr />
        <Button onClick={() => refreshMapping}>Refresh</Button>
      </>
    );
  }

  if (dnpsRequest.error)
    return <ErrorView error={dnpsRequest.error} hideIcon red />;
  if (mappings.error) return <ErrorView error={mappings.error} hideIcon red />;

  if (dnpsRequest.isValidating)
    return <Ok loading msg="Loading HTTPS portal" />;
  if (mappings.isValidating) return <Ok loading msg="Loading mappings" />;

  return <ErrorView error={"No data"} hideIcon red />;
}
