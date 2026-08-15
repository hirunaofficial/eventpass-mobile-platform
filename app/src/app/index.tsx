import { useState } from "react";
import { ScrollView, View } from "react-native";
import { ChevronsUpDown, Info } from "lucide-react-native";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-3">
      <Text variant="large">{title}</Text>
      {children}
    </View>
  );
}

export default function Index() {
  const [checked, setChecked] = useState(true);
  const [switchOn, setSwitchOn] = useState(false);
  const [radioValue, setRadioValue] = useState("general");
  const [selectValue, setSelectValue] = useState<{ value: string; label: string } | undefined>();
  const [progress, setProgress] = useState(42);
  const [tab, setTab] = useState("upcoming");

  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="gap-6 p-4 pt-16">
      <View>
        <Text variant="h1" className="text-3xl">
          EventPass
        </Text>
        <Text variant="muted">Component showcase — every ui/* component in one place</Text>
      </View>

      <Section title="Text variants">
        <Text variant="h2">Heading 2</Text>
        <Text variant="h3">Heading 3</Text>
        <Text variant="p">Paragraph text with a bit more leading.</Text>
        <Text variant="lead">Lead text, larger and muted.</Text>
        <Text variant="small">Small text</Text>
        <Text variant="muted">Muted helper text</Text>
      </Section>

      <Separator />

      <Section title="Button variants">
        <View className="flex-row flex-wrap gap-2">
          <Button>
            <Text>Default</Text>
          </Button>
          <Button variant="secondary">
            <Text>Secondary</Text>
          </Button>
          <Button variant="outline">
            <Text>Outline</Text>
          </Button>
          <Button variant="ghost">
            <Text>Ghost</Text>
          </Button>
          <Button variant="destructive">
            <Text>Destructive</Text>
          </Button>
          <Button variant="link">
            <Text>Link</Text>
          </Button>
        </View>
      </Section>

      <Separator />

      <Section title="Badges & Alert">
        <View className="flex-row flex-wrap gap-2">
          <Badge>
            <Text>Default</Text>
          </Badge>
          <Badge variant="secondary">
            <Text>Secondary</Text>
          </Badge>
          <Badge variant="outline">
            <Text>Outline</Text>
          </Badge>
          <Badge variant="destructive">
            <Text>Destructive</Text>
          </Badge>
        </View>
        <Alert icon={Info}>
          <AlertTitle>Heads up</AlertTitle>
          <AlertDescription>This event overlaps with one already in your itinerary.</AlertDescription>
        </Alert>
      </Section>

      <Separator />

      <Section title="Card">
        <Card>
          <CardHeader className="flex-row items-center gap-3">
            <Avatar alt="Event organizer avatar">
              <AvatarFallback>
                <Text>CT</Text>
              </AvatarFallback>
            </Avatar>
            <View>
              <Text variant="large">Colombo Tech Meetup</Text>
              <Text variant="muted">Independence Arcade</Text>
            </View>
          </CardHeader>
          <CardContent>
            <AspectRatio ratio={16 / 9} className="bg-muted rounded-md">
              <View className="flex-1 items-center justify-center">
                <Text variant="muted">16:9 image placeholder</Text>
              </View>
            </AspectRatio>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button variant="ghost" size="sm">
              <Text>Details</Text>
            </Button>
            <Button size="sm">
              <Text>Add</Text>
            </Button>
          </CardFooter>
        </Card>
      </Section>

      <Separator />

      <Section title="Form controls">
        <View className="gap-2">
          <Label>Search events</Label>
          <Input placeholder="Search events" />
        </View>
        <View className="gap-2">
          <Label>Notes</Label>
          <Textarea placeholder="Anything else the organizer should know?" />
        </View>
        <View className="flex-row items-center gap-2">
          <Checkbox checked={checked} onCheckedChange={setChecked} />
          <Label onPress={() => setChecked((v) => !v)}>Remind me before this event</Label>
        </View>
        <View className="flex-row items-center gap-2">
          <Switch checked={switchOn} onCheckedChange={setSwitchOn} />
          <Label onPress={() => setSwitchOn((v) => !v)}>Offline sync enabled</Label>
        </View>
        <RadioGroup value={radioValue} onValueChange={setRadioValue} className="gap-3">
          <View className="flex-row items-center gap-2">
            <RadioGroupItem value="general" aria-labelledby="general-label" />
            <Label nativeID="general-label" onPress={() => setRadioValue("general")}>
              General admission
            </Label>
          </View>
          <View className="flex-row items-center gap-2">
            <RadioGroupItem value="vip" aria-labelledby="vip-label" />
            <Label nativeID="vip-label" onPress={() => setRadioValue("vip")}>
              VIP
            </Label>
          </View>
        </RadioGroup>
        <View className="gap-2">
          <Label>Ticket type</Label>
          <Select value={selectValue} onValueChange={setSelectValue}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a ticket type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem label="General" value="general" />
              <SelectItem label="VIP" value="vip" />
              <SelectItem label="Student" value="student" />
            </SelectContent>
          </Select>
        </View>
      </Section>

      <Separator />

      <Section title="Progress & Skeleton">
        <Progress value={progress} />
        <View className="flex-row gap-2">
          <Button size="sm" variant="outline" onPress={() => setProgress((p) => Math.max(0, p - 10))}>
            <Text>-10</Text>
          </Button>
          <Button size="sm" variant="outline" onPress={() => setProgress((p) => Math.min(100, p + 10))}>
            <Text>+10</Text>
          </Button>
        </View>
        <View className="gap-2">
          <Skeleton className="h-4 w-3/4 rounded" />
          <Skeleton className="h-4 w-1/2 rounded" />
        </View>
      </Section>

      <Separator />

      <Section title="Tabs">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="flex-row">
            <TabsTrigger value="upcoming" className="flex-1">
              <Text>Upcoming</Text>
            </TabsTrigger>
            <TabsTrigger value="past" className="flex-1">
              <Text>Past</Text>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="upcoming">
            <Text variant="muted">3 upcoming events in your itinerary.</Text>
          </TabsContent>
          <TabsContent value="past">
            <Text variant="muted">No past events yet.</Text>
          </TabsContent>
        </Tabs>
      </Section>

      <Separator />

      <Section title="Collapsible & Popover">
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="flex-row justify-between">
              <Text>Venue details</Text>
              <Icon as={ChevronsUpDown} size={16} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Text variant="muted" className="mt-2">
              Independence Arcade, 3rd floor. Wheelchair accessible entrance on the west side.
            </Text>
          </CollapsibleContent>
        </Collapsible>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <Text>What does "clash" mean?</Text>
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <Text variant="muted">
              Two events clash if they overlap in time, or if there isn't enough travel time
              between their venues.
            </Text>
          </PopoverContent>
        </Popover>
      </Section>

      <Separator />

      <Section title="Dialog & Alert Dialog">
        <View className="flex-row flex-wrap gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Text>Open dialog</Text>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Event details</DialogTitle>
                <DialogDescription>
                  This is a plain dialog — used for details/forms that don't need a
                  destructive confirmation.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button>
                  <Text>Close</Text>
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Text>Remove from itinerary</Text>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove this event?</AlertDialogTitle>
                <AlertDialogDescription>
                  This is the clash-warning pattern the real constraint solver will use.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>
                  <Text>Cancel</Text>
                </AlertDialogCancel>
                <AlertDialogAction>
                  <Text>Remove</Text>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </View>
      </Section>
    </ScrollView>
  );
}
