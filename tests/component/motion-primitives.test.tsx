import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import React from "react"

vi.mock("motion/react", async () => {
  const React = await import("react")

  const MotionDiv = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ children, className, style }, ref) =>
      <div ref={ref} className={className} style={style} data-testid="motion-div">{children}</div>
  )
  MotionDiv.displayName = "MotionDiv"

  const MotionButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
    ({ children, className, ...rest }, ref) =>
      <button ref={ref} className={className} data-testid="motion-button" {...rest}>{children}</button>
  )
  MotionButton.displayName = "MotionButton"

  return {
    motion: { div: MotionDiv, button: MotionButton },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }
})

import { FadeUp } from "@/components/admin/motion/fade-up"
import { StaggerList } from "@/components/admin/motion/stagger-list"
import { HoverCard } from "@/components/admin/motion/hover-card"
import { PressButton } from "@/components/admin/motion/press-button"

describe("FadeUp", () => {
  it("renders its children", () => {
    render(<FadeUp><span data-testid="child">hello</span></FadeUp>)
    expect(screen.getByTestId("child")).toBeInTheDocument()
  })

  it("wraps children in a motion div", () => {
    const { container } = render(<FadeUp><span>x</span></FadeUp>)
    expect(container.querySelector("[data-testid='motion-div']")).toBeInTheDocument()
  })

  it("passes className to the wrapper", () => {
    const { container } = render(<FadeUp className="my-class"><span>x</span></FadeUp>)
    expect(container.querySelector(".my-class")).toBeInTheDocument()
  })
})

describe("StaggerList", () => {
  it("renders all children", () => {
    render(
      <StaggerList>
        <span data-testid="a">A</span>
        <span data-testid="b">B</span>
        <span data-testid="c">C</span>
      </StaggerList>
    )
    expect(screen.getByTestId("a")).toBeInTheDocument()
    expect(screen.getByTestId("b")).toBeInTheDocument()
    expect(screen.getByTestId("c")).toBeInTheDocument()
  })

  it("wraps each child in a motion div for stagger (container + N children)", () => {
    const { container } = render(
      <StaggerList>
        <span>A</span>
        <span>B</span>
      </StaggerList>
    )
    // 1 container motion.div + 2 per-child motion.divs = 3
    expect(container.querySelectorAll("[data-testid='motion-div']").length).toBe(3)
  })
})

describe("HoverCard", () => {
  it("renders its children", () => {
    render(<HoverCard><span data-testid="inner">card</span></HoverCard>)
    expect(screen.getByTestId("inner")).toBeInTheDocument()
  })

  it("wraps children in a motion div", () => {
    const { container } = render(<HoverCard><span>x</span></HoverCard>)
    expect(container.querySelector("[data-testid='motion-div']")).toBeInTheDocument()
  })
})

describe("PressButton", () => {
  it("renders as a button element", () => {
    const { container } = render(<PressButton>Save</PressButton>)
    expect(container.querySelector("[data-testid='motion-button']")).toBeInTheDocument()
  })

  it("renders children", () => {
    render(<PressButton>Click me</PressButton>)
    expect(screen.getByText("Click me")).toBeInTheDocument()
  })

  it("forwards className to the button", () => {
    const { container } = render(<PressButton className="my-btn">OK</PressButton>)
    expect(container.querySelector(".my-btn")).toBeInTheDocument()
  })
})
