import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Building2, Briefcase, Image, Mail, Phone, RotateCcw, Save, Upload, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { getSystemBranding, saveSystemBranding, useSystemBranding } from "@/lib/system-branding";
import {
  EMPTY_PROFILE_SETTINGS,
  fetchUserProfileSettings,
  saveUserProfileSettings,
  type UserProfileSettings,
} from "@/lib/user-settings";

interface LocalProfile {
  phone: string;
  role: string;
  company: string;
  bio: string;
}

const defaultProfile: LocalProfile = {
  phone: "",
  role: "",
  company: "",
  bio: "",
};

function profileStorageKey(userId: string) {
  return `financeiro-profile-${userId}`;
}

function readLocalProfile(userId: string): LocalProfile {
  try {
    const raw = window.localStorage.getItem(profileStorageKey(userId));
    if (!raw) return defaultProfile;
    return { ...defaultProfile, ...JSON.parse(raw) };
  } catch {
    return defaultProfile;
  }
}

export default function Configuracao() {
  const { user, updateProfile, getToken, isLoaded } = useAuth();
  const { toast } = useToast();
  const branding = useSystemBranding();
  const userId = user?.id ?? "local";
  const displayName = user?.user_metadata?.name ?? "";
  const initials = (displayName || user?.email || "U").slice(0, 1).toUpperCase();

  const initialProfile = useMemo(() => readLocalProfile(userId), [userId]);
  const [name, setName] = useState(displayName);
  const [phone, setPhone] = useState(initialProfile.phone);
  const [role, setRole] = useState(initialProfile.role);
  const [company, setCompany] = useState(initialProfile.company);
  const [bio, setBio] = useState(initialProfile.bio);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(() => getSystemBranding().logoDataUrl);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const profile = readLocalProfile(userId);
    setName(displayName);
    setPhone(profile.phone);
    setRole(profile.role);
    setCompany(profile.company);
    setBio(profile.bio);
  }, [displayName, userId]);

  useEffect(() => {
    setLogoDataUrl(branding.logoDataUrl);
  }, [branding.logoDataUrl]);

  useEffect(() => {
    if (!isLoaded || !user) return;

    let cancelled = false;

    (async () => {
      try {
        const remote = await fetchUserProfileSettings(getToken);
        if (cancelled) return;

        const local = readLocalProfile(userId);
        const localLogo = getSystemBranding().logoDataUrl;
        const hasLocalProfile = Boolean(local.phone || local.role || local.company || local.bio || localLogo);
        const hasRemoteProfile = Boolean(remote.phone || remote.role || remote.company || remote.bio || remote.logoDataUrl);
        const profileToUse: UserProfileSettings =
          hasLocalProfile && !hasRemoteProfile
            ? await saveUserProfileSettings({ ...local, logoDataUrl: localLogo }, getToken)
            : remote;

        if (cancelled) return;
        setPhone(profileToUse.phone);
        setRole(profileToUse.role);
        setCompany(profileToUse.company);
        setBio(profileToUse.bio);
        setLogoDataUrl(profileToUse.logoDataUrl);
        saveSystemBranding({ logoDataUrl: profileToUse.logoDataUrl });
      } catch {
        if (!cancelled) {
          const local = readLocalProfile(userId);
          setPhone(local.phone);
          setRole(local.role);
          setCompany(local.company);
          setBio(local.bio);
          setLogoDataUrl(getSystemBranding().logoDataUrl);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, user, userId]);

  function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Arquivo inválido",
        description: "Selecione uma imagem para usar como logo.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 1024 * 1024) {
      toast({
        title: "Imagem muito grande",
        description: "Use uma imagem com até 1 MB.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(String(reader.result));
    reader.onerror = () => {
      toast({
        title: "Não foi possível carregar a logo",
        description: "Tente selecionar outro arquivo.",
        variant: "destructive",
      });
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    try {
      const trimmedName = name.trim();
      if (!trimmedName) {
        throw new Error("Informe o nome que será exibido no sistema.");
      }

      await updateProfile({ name: trimmedName });
      const saved = await saveUserProfileSettings(
        {
          ...EMPTY_PROFILE_SETTINGS,
          phone: phone.trim(),
          role: role.trim(),
          company: company.trim(),
          bio: bio.trim(),
          logoDataUrl,
        },
        getToken,
      );
      window.localStorage.setItem(profileStorageKey(userId), JSON.stringify(saved));
      saveSystemBranding({ logoDataUrl: saved.logoDataUrl });
      setLogoDataUrl(saved.logoDataUrl);

      toast({
        title: "Configurações salvas",
        description: "Seu perfil e a logo do sistema foram atualizados.",
      });
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configuração</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Atualize os dados do seu perfil e a identidade visual exibida no sistema.
          </p>
        </div>
        <Button type="submit" disabled={isSaving}>
          <Save className="h-4 w-4" />
          {isSaving ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <UserRound className="h-5 w-5 text-primary" />
              Perfil do usuário
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="email" value={user?.email ?? ""} readOnly className="pl-9 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} className="pl-9" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Cargo</Label>
                <div className="relative">
                  <Briefcase className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="role" value={role} onChange={(event) => setRole(event.target.value)} className="pl-9" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Empresa</Label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="company" value={company} onChange={(event) => setCompany(event.target.value)} className="pl-9" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Observações do perfil</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                className="min-h-24 resize-none"
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Image className="h-5 w-5 text-primary" />
                Logo do sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex aspect-[16/9] items-center justify-center rounded-md border border-dashed bg-muted/30 p-6">
                {logoDataUrl ? (
                  <img src={logoDataUrl} alt="Logo do sistema" className="max-h-full max-w-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
                    <div className="flex h-14 w-14 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Image className="h-7 w-7" />
                    </div>
                    <p className="text-sm">Nenhuma logo personalizada</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="outline" asChild className="flex-1">
                  <label htmlFor="logo-upload" className="cursor-pointer">
                    <Upload className="h-4 w-4" />
                    Enviar logo
                  </label>
                </Button>
                <input id="logo-upload" type="file" accept="image/*" className="sr-only" onChange={handleLogoChange} />
                <Button type="button" variant="ghost" onClick={() => setLogoDataUrl(null)} disabled={!logoDataUrl}>
                  <X className="h-4 w-4" />
                  Remover
                </Button>
              </div>

              <Button type="button" variant="secondary" className="w-full" onClick={() => setLogoDataUrl(branding.logoDataUrl)}>
                <RotateCcw className="h-4 w-4" />
                Desfazer alterações da logo
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Prévia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 rounded-md border bg-background p-4">
                {logoDataUrl ? (
                  <img src={logoDataUrl} alt="Logo em miniatura" className="h-10 w-10 rounded-md object-contain" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
                    SF
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">Sistema Financeiro</p>
                  <p className="truncate text-xs text-muted-foreground">{name || "Usuário"}</p>
                </div>
                <div className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {initials}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
