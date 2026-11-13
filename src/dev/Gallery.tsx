import React, { useState } from "react";
import {
  Banner,
  Blocks,
  Button,
  Canvas,
  Checkbox,
  Chip,
  ChipButton,
  Col,
  Command,
  ConfirmProvider,
  Dim,
  Dot,
  Empty,
  Facts,
  Field,
  Fields,
  FormRow,
  GroupCaption,
  Icon,
  Inspector,
  List,
  Menu,
  MenuCaption,
  MenuItem,
  MenuSeparator,
  Meters,
  MoreButton,
  NavItem,
  PortalProvider,
  Problem,
  Progress,
  Row,
  RowHead,
  Select,
  Sev,
  Sheet,
  SkeletonRows,
  Sparkline,
  Switch,
  TabPanel,
  Tabs,
  Tile,
  Tiles,
  ToastProvider,
  Tooltip,
  TooltipProvider,
  useConfirm,
  useToast,
  type IconName,
  type SelectOption,
  type TabItem,
} from "../ui/op";

const ICONS: IconName[] = [
  "search", "plus", "more", "chev-down", "chev-right", "close", "copy", "check", "error", "alert", "info",
  "download", "play", "stop", "restart", "trash", "external", "folder", "box", "image", "database", "network",
  "cluster", "doctor", "settings", "sidebar", "terminal", "logs", "refresh", "command", "back", "activity",
  "help", "updown", "chev-up",
];

const BUTTON_VARIANTS = ["default", "primary", "danger", "ghost"] as const;
const BUTTON_SIZES = ["xs", "sm", "md"] as const;
const BUTTON_LABELS = {
  default: "Restart",
  primary: "Start",
  danger: "Remove kafka-ui",
  ghost: "Logs",
} as const;

const SELECT_OPTIONS: SelectOption[] = [
  { value: "kafka", label: "kafka", hint: "Running" },
  { value: "kafka-ui", label: "kafka-ui", hint: "Running" },
  { value: "shop", label: "shop", hint: "5 of 7 running" },
  { value: "api", label: "api", hint: "Unhealthy" },
];

const TABS: TabItem[] = [
  { value: "logs", label: "Logs" },
  { value: "stats", label: "Stats" },
  { value: "settings", label: "Settings" },
];

function Section(props: { name: string; children?: React.ReactNode }): React.JSX.Element {
  return (
    <section>
      <div className="group-cap">{props.name}</div>
      {props.children}
    </section>
  );
}

function GalleryBody(): React.JSX.Element {
  const confirm = useConfirm();
  const toast = useToast();
  const [select, setSelect] = useState("kafka");
  const [switchOn, setSwitchOn] = useState(true);
  const [switchOff, setSwitchOff] = useState(false);
  const [tab, setTab] = useState("logs");
  const [checked, setChecked] = useState(true);
  const [selectedRow, setSelectedRow] = useState(true);
  const [shopOpen, setShopOpen] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  return (
    <div className="content">
      <Section name="Icon">
        <div className="fields">
          {ICONS.map((name) => (
            <React.Fragment key={name}>
              <Icon name={name} />
              <Icon name={name} size="sm" />
            </React.Fragment>
          ))}
        </div>
      </Section>

      <Section name="Button">
        <div className="fields">
          {BUTTON_VARIANTS.flatMap((variant) =>
            BUTTON_SIZES.map((size) => (
              <Button key={`${variant}-${size}`} variant={variant} size={size}>
                {BUTTON_LABELS[variant]}
              </Button>
            )),
          )}
        </div>
        <div className="fields">
          <Button icon="play">Start</Button>
          <Button busy>Start</Button>
          <Button disabled>Start</Button>
          <Button iconOnly icon="more" aria-label="More actions for kafka" />
        </div>
      </Section>

      <Section name="Field">
        <div className="fields">
          <Field placeholder="Search containers" aria-label="Search containers" />
          <Field icon="search" placeholder="Search containers" aria-label="Search containers" />
        </div>
        <Field defaultValue="5432" aria-label="Port on this Mac" invalid="Port 5432 on this Mac is already used by db." />
        <FormRow label="Name" htmlFor="gallery-name">
          <Field id="gallery-name" defaultValue="kafka" aria-label="Name" />
        </FormRow>
        <Fields>
          <Field defaultValue="5432" aria-label="Port on this Mac" />
          <span className="muted nowrap">on this Mac, to</span>
          <Field defaultValue="5432" aria-label="Port in the container" />
          <span className="muted nowrap">in the container</span>
        </Fields>
      </Section>

      <Section name="Select">
        <Select value={select} onChange={setSelect} options={SELECT_OPTIONS} aria-label="Container" width="pick" />
      </Section>

      <Section name="Switch">
        <div className="fields">
          <span id="gallery-switch-on">Running</span>
          <Switch checked={switchOn} onChange={setSwitchOn} aria-labelledby="gallery-switch-on" />
          <span id="gallery-switch-off">Stopped</span>
          <Switch checked={switchOff} onChange={setSwitchOff} aria-labelledby="gallery-switch-off" />
        </div>
      </Section>

      <Section name="Chip">
        <div className="fields">
          <Chip>kafka</Chip>
          <Chip>shop</Chip>
          <ChipButton pressed>Follow</ChipButton>
          <ChipButton>Follow</ChipButton>
          <ChipButton icon="chev-right" aria-expanded={false}>More options</ChipButton>
        </div>
      </Section>

      <Section name="Tabs">
        <Tabs value={tab} onChange={setTab} items={TABS} aria-label="kafka" aside={<ChipButton pressed>Follow</ChipButton>}>
          <TabPanel value="logs"><span className="muted">kafka</span></TabPanel>
          <TabPanel value="stats"><span className="muted">2% · 512 MB</span></TabPanel>
          <TabPanel value="settings"><span className="muted">kafka</span></TabPanel>
        </Tabs>
      </Section>

      <Section name="Dot">
        <div className="fields">
          <Dot state="ok" label="Running" />
          <Dot state="warn" label="Restarting" />
          <Dot state="bad" label="Unhealthy" />
          <Dot state="busy" label="Starting" />
          <Dot state="off" label="Stopped" />
        </div>
      </Section>

      <Section name="Sev">
        <div className="fields">
          <Sev level="bad" />
          <Sev level="warn" />
          <Sev level="info" />
          <Sev level="ok" />
        </div>
      </Section>

      <Section name="Tooltip">
        <Tooltip text="Logs" shortcut="↵ Open">
          <Button>Logs</Button>
        </Tooltip>
      </Section>

      <Section name="Banner">
        <Banner
          tone="bad"
          title="Its health check is failing"
          actions={<Button variant="primary">See why</Button>}
        >
          5 checks in a row failed. The last one said: "curl: (7) Failed to connect to localhost port 8080 after 0 ms: Connection refused"
        </Banner>
        <Banner tone="warn" actions={<Button size="xs">Use 5433 instead</Button>}>
          Port 5432 on this Mac is already used by <span className="mono">db</span>.
        </Banner>
        <Banner
          tone="info"
          title="Two ports were moved so this project can run next to shop"
          actions={<Button>Show what changed</Button>}
        >
          Your Compose file was not changed.
        </Banner>
      </Section>

      <Section name="Empty">
        <Empty
          icon="box"
          title="No containers yet"
          actions={<><Button variant="primary">Run an image</Button><Button>Start a Compose project</Button></>}
        >
          Run an image, or start a Compose project from a folder.
        </Empty>
      </Section>

      <Section name="SkeletonRows">
        <SkeletonRows />
      </Section>

      <Section name="Canvas">
        <Canvas
          aria-label="Logs of api"
          lines={[
            { time: "18:01:00", text: "/docker-entrypoint.sh: Configuration complete; ready for start up" },
            { time: "18:01:01", text: "GET /health 503 \"connection refused: db:5432\"", level: "w" },
            { time: "18:01:02", text: "curl: (7) Failed to connect to localhost port 8080: Connection refused", level: "e" },
          ]}
        />
      </Section>

      <Section name="Command">
        <Command text="docker --context colima rm -f kafka-ui" />
      </Section>

      <Section name="Tile">
        <Tiles>
          <Tile label="Build cache" value="3.4 GB">
            <span>All can be freed</span>
            <Button size="xs">Clear</Button>
          </Tile>
          <Tile label="Images" value="1.6 GB">
            <span>666 MB unused</span>
            <Button size="xs">Remove unused</Button>
          </Tile>
        </Tiles>
      </Section>

      <Section name="Facts">
        <Facts
          items={[
            { label: "Image", value: "acme/billing-api:3.1" },
            { label: "Project", value: "shop" },
            { label: "Started", value: "3 h ago" },
            { label: "Restarts", value: "0 restarts" },
          ]}
        />
      </Section>

      <Section name="GroupCaption">
        <GroupCaption count={4}>Need attention</GroupCaption>
        <GroupCaption>Running</GroupCaption>
      </Section>

      <Section name="NavItem">
        <div className="list">
          <NavItem href="#/containers" icon="box" label="Containers" current count={5} countBad countLabel="5 need attention" />
          <NavItem href="#/projects" icon="folder" label="Projects" count={3} />
          <NavItem href="#/images" icon="image" label="Images" />
        </div>
      </Section>

      <Section name="Checkbox">
        <Checkbox checked={checked} onChange={setChecked}>Keep its data</Checkbox>
        <Checkbox checked={false} onChange={() => {}} disabled>Keep its data</Checkbox>
      </Section>

      <Section name="Progress">
        <Progress value={0.5} aria-label="Starting default" />
        <Progress value={null} aria-label="Starting default" />
      </Section>

      <Section name="Portal">
        <PortalProvider container={null}>
          <div className="muted">Sheet, ConfirmDialog and Toast</div>
        </PortalProvider>
      </Section>

      <Section name="Row">
        <List aria-label="Containers">
          <RowHead menuGap>
            <span className="lead"></span>
            <span className="name">Name</span>
            <span className="meta grow">Image or folder</span>
            <span className="col ports">Ports</span>
            <span className="col stats mono">Now</span>
            <span className="col state">State</span>
            <span className="act"></span>
          </RowHead>
          <Row
            lead={<Dot state="warn" />}
            name={<>kafka<Dim>:3.8</Dim></>}
            meta="apache/kafka:3.8"
            action={<Button>Stop</Button>}
            menu={
              <Menu trigger={<MoreButton name="kafka" />} label="Actions for kafka" align="end">
                <MenuItem label="Logs" why="To see what it printed" onSelect={() => {}} />
                <MenuSeparator />
                <MenuItem label="Remove…" danger onSelect={() => {}} />
              </Menu>
            }
            onOpen={() => setInspectorOpen(true)}
          >
            <Col kind="ports">:9092</Col>
            <Col kind="stats" mono>2% · 512 MB</Col>
            <Col kind="state">Running</Col>
          </Row>
          <Row
            lead={<Dot state="bad" />}
            name="kafka-ui"
            meta="provectuslabs/kafka-ui"
            selected={selectedRow}
            onSelect={setSelectedRow}
            action={<Button>Stop</Button>}
          >
            <Col kind="ports">:8082</Col>
            <Col kind="stats" mono>0% · 310 MB</Col>
            <Col kind="state">Running</Col>
          </Row>
          <Row
            lead={<Icon name="chev-down" size="sm" />}
            dot={<Dot state="bad" />}
            name="shop"
            meta="~/code/shop"
            expanded={shopOpen}
            onToggle={() => setShopOpen((open) => !open)}
            action={<Button>Stop</Button>}
          >
            <Blocks
              services={[
                { name: "kafka", state: "ok", label: "Running" },
                { name: "kafka-ui", state: "ok", label: "Running" },
                { name: "api", state: "warn", label: "Restarting" },
                { name: "web", state: "bad", label: "Unhealthy" },
                { name: "db", state: "off", label: "Stopped" },
              ]}
            />
            <Col kind="ports">:8080</Col>
            <Sparkline points={[2, 3, 5, 4, 6, 2, 5, 7, 4, 5, 6, 3]} label="CPU for shop" />
            <Col kind="state-wide">5 of 7 running</Col>
          </Row>
          <Row
            child
            lead={<Dot state="bad" />}
            name="api"
            meta="acme/billing-api:3.1"
            action={<Button>Stop</Button>}
            onOpen={() => setInspectorOpen(true)}
          >
            <Col kind="ports">:8080</Col>
            <Col kind="stats" mono>1% · 120 MB</Col>
            <Col kind="state">Unhealthy</Col>
          </Row>
          <Problem
            level="bad"
            text="Its health check is failing"
            action={<Button size="xs">See why</Button>}
            onOpen={() => setInspectorOpen(true)}
          />
          <Problem
            level="warn"
            text="Keeps restarting. It stopped 6 times in the last 10 minutes."
            action={<Button size="xs">See why</Button>}
          />
          <Row tall lead={<Dot state="ok" />} name="scratch-postgres" meta="postgres:16" action={<Button>Stop</Button>} />
        </List>
      </Section>

      <Section name="Problem">
        <Problem level="bad" text="Can't reach Kafka" action={<Button size="xs" variant="primary">Fix kafka and kafka-ui…</Button>} onOpen={() => setInspectorOpen(true)} />
        <Problem level="warn" text="Only reachable from your Mac. Fixed together with kafka-ui." />
        <Problem level="bad" child text="Its health check is failing" action={<Button size="xs">See why</Button>} />
      </Section>

      <Section name="Blocks">
        <Blocks
          services={[
            { name: "kafka", state: "ok", label: "Running" },
            { name: "kafka-ui", state: "warn", label: "Restarting" },
            { name: "api", state: "bad", label: "Unhealthy" },
            { name: "shop", state: "off", label: "Stopped" },
          ]}
        />
        <Blocks
          services={Array.from({ length: 11 }, (_, index) => ({
            name: index === 2 ? "api" : "kafka",
            state: index === 2 ? "bad" : "ok",
            label: index === 2 ? "Unhealthy" : "Running",
          }))}
        />
      </Section>

      <Section name="Sparkline">
        <div className="fields">
          <Sparkline points={[2, 3, 5, 4, 6, 2, 5, 7, 4, 5, 6, 3]} label="CPU for kafka" />
          <Sparkline points={null} label="CPU for kafka" />
        </div>
      </Section>

      <Section name="Meters">
        <Meters
          onOpen={() => {}}
          meters={[
            { label: "CPU", share: 0.12, text: "12%" },
            { label: "Memory", share: 0.64, text: "5.1 of 8 GB", hot: true },
            { label: "Disk", share: 0.68, text: "41 of 60 GB" },
          ]}
        />
      </Section>

      <Section name="Menu">
        <Menu trigger={<MoreButton name="kafka" />} label="Actions for kafka" wide align="end">
          <MenuCaption>Containers</MenuCaption>
          <MenuItem label="Logs" why="To see what it printed" onSelect={() => {}} />
          <MenuItem label="Open a shell" shortcut="↵ Open" onSelect={() => {}} />
          <MenuItem label="Restart" disabled onSelect={() => {}} />
          <MenuSeparator />
          <MenuItem label="Remove…" why="Deletes the container. Volumes are kept" danger onSelect={() => {}} />
        </Menu>
      </Section>

      <Section name="Sheet">
        <Button onClick={() => setSheetOpen(true)}>Run postgres:16</Button>
        <Sheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Run postgres:16"
          fact="postgres:16"
          footer={<><Button size="md" variant="ghost" onClick={() => setSheetOpen(false)}>Cancel</Button><Button size="md" variant="primary" onClick={() => setSheetOpen(false)}>Run</Button></>}
        >
          <FormRow label="Name" htmlFor="gallery-sheet-name">
            <Field id="gallery-sheet-name" size="md" defaultValue="postgres" aria-label="Name" />
          </FormRow>
        </Sheet>
      </Section>

      <Section name="ConfirmDialog">
        <div className="fields">
          <Button
            onClick={() => {
              void confirm({
                title: "Remove kafka-ui?",
                body: "This deletes the container. Its image and volumes are kept, so you can run it again.",
                command: "docker --context colima rm -f kafka-ui",
                confirm: "Remove",
                danger: true,
              });
            }}
          >
            Remove kafka-ui
          </Button>
          <Button
            onClick={() => {
              void confirm({
                title: "Restart kafka?",
                body: "This stops the container and starts it again.",
                confirm: "Restart",
              });
            }}
          >
            Restart kafka
          </Button>
        </div>
      </Section>

      <Section name="Toast">
        <Button onClick={() => toast({ text: "Removed kafka-ui", action: { label: "Undo", onSelect: () => {} } })}>
          Remove kafka-ui
        </Button>
      </Section>

      <Section name="Inspector">
        <Button onClick={() => setInspectorOpen(true)}>See why</Button>
        <Inspector
          open={inspectorOpen}
          onClose={() => setInspectorOpen(false)}
          crumb="shop / api"
          title="Its health check is failing"
          lede="The container is running, but 5 checks in a row could not connect to port 8080 inside it. The app listens on another port."
          evidence={[
            { text: "14:02:11 curl -f http://localhost:8080/health" },
            { text: "curl: (7) Failed to connect to localhost port 8080: Connection refused", bad: true },
            { text: "14:02:11 exit 7" },
          ]}
          findings={[
            "The logs say Listening on :3000. The app and the check disagree on the port.",
            "The Compose file sets the check to 8080 and PORT is not set.",
          ]}
          actions={<><Button variant="primary" size="md">Set PORT to 8080 and restart</Button><Button size="md">Open logs</Button><Button size="md">Open a shell</Button></>}
          command="docker --context colima compose -p shop up -d api"
        />
      </Section>
    </div>
  );
}

export default function Gallery(): React.JSX.Element {
  return (
    <TooltipProvider>
      <ConfirmProvider>
        <ToastProvider>
          <GalleryBody />
        </ToastProvider>
      </ConfirmProvider>
    </TooltipProvider>
  );
}