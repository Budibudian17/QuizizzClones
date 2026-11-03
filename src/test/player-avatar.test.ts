import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { AvatarCustomizer, PlayerAvatar } from "@/components/PlayerAvatar";
import { DEFAULT_AVATAR, normalizeAvatar } from "@/game/player-avatar";

describe("player avatars", () => {
  it("uses safe defaults for missing or invalid saved avatar settings", () => {
    expect(normalizeAvatar(null)).toEqual(DEFAULT_AVATAR);
    expect(normalizeAvatar({ character: "unknown", hat: "helmet" })).toEqual(DEFAULT_AVATAR);
    expect(
      normalizeAvatar({ ...DEFAULT_AVATAR, hair: "curly", shirt: "plum", pants: "denim" }),
    ).toEqual({ ...DEFAULT_AVATAR, hair: "curly", shirt: "plum", pants: "denim" });
  });

  it("describes the selected character and accessories accessibly", () => {
    render(
      createElement(PlayerAvatar, {
        avatar: {
          ...DEFAULT_AVATAR,
          character: "fox",
          hat: "crown",
          glasses: "round",
          bag: "backpack",
        },
      }),
    );

    expect(screen.getByRole("img")).toHaveAttribute("viewBox", "0 0 128 192");
    expect(
      screen.getByRole("img", {
        name: "Rubah, Mahkota, Bulat, Ransel",
      }),
    ).toBeInTheDocument();
  });

  it("renders a responsive avatar studio and reports option changes", () => {
    const onChange = vi.fn();
    const onSave = vi.fn();
    const onCancel = vi.fn();
    const { container } = render(
      createElement(AvatarCustomizer, {
        value: DEFAULT_AVATAR,
        nickname: "Pemain",
        onChange,
        onSave,
        onCancel,
      }),
    );

    expect(screen.getByText("Preview karakter")).toBeInTheDocument();
    expect(container.querySelector(".order-1")).toBeInTheDocument();
    expect(container.querySelector(".order-2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Indigo" }));
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_AVATAR, shirt: "indigo" });

    fireEvent.click(screen.getByRole("button", { name: "Kembali ke lobby" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
